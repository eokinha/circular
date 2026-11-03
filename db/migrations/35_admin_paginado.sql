-- Migração 35: telas de admin paginadas (20 por página), com filtro e busca no banco
--
-- admin_contas_pagina(p_filtro, p_busca, p_pagina)  → /admin/contas
--   p_filtro: todas | ativa | suspensa | bloqueada | denuncias (mesma regra de situacaoDaConta em src/lib/contas.ts)
-- admin_lojas_pagina(p_status, p_busca, p_pagina)   → /admin/lojas, aba Perfis
-- admin_produtos_pagina(p_destaque, p_busca, p_pagina) → /admin/lojas, aba Anúncios
-- Todas devolvem {itens, total, pagina, por_pagina, ...contagens}. A busca é ILIKE com %, _ e \ escapados
-- e limitada a 100 caracteres. `por_pagina` espelha POR_PAGINA_ADMIN em src/lib/paginacao.ts (mudar juntos).
-- admin_listar_usuarios/admin_listar_lojas continuam para o deploy anterior; remover numa migração seguinte.

BEGIN;

-- Termo de busca → padrão ILIKE seguro (NULL quando vazio)
CREATE OR REPLACE FUNCTION public.padrao_busca_admin(p_busca text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(COALESCE(p_busca, '')), '') IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(left(btrim(p_busca), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;
$$;
REVOKE ALL ON FUNCTION public.padrao_busca_admin(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_contas_pagina(p_filtro text DEFAULT 'todas', p_busca text DEFAULT NULL, p_pagina integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por_pagina CONSTANT integer := 20;
  v_pagina integer := GREATEST(COALESCE(p_pagina, 1), 1);
  v_filtro text := COALESCE(p_filtro, 'todas');
  v_padrao text := public.padrao_busca_admin(p_busca);
  v_resultado jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF v_filtro NOT IN ('todas', 'ativa', 'suspensa', 'bloqueada', 'denuncias') THEN
    RAISE EXCEPTION 'Filtro inválido' USING ERRCODE = '22023';
  END IF;

  WITH base AS (
    SELECT u.id, u.nome, u.sobrenome, u.email, u.telefone, u.matricula,
           u.matricula_status, u.matricula_validada, u.instituicoes_id, i.nome AS instituicao_nome,
           l.id AS loja_id, u.status, u.is_admin, u.criado_em, u.bloqueado_ate, u.moderacao_motivo,
           CASE WHEN u.status <> 'bloqueado' THEN 'ativa'
                WHEN u.bloqueado_ate IS NOT NULL THEN 'suspensa'
                ELSE 'bloqueada' END AS situacao,
           (SELECT count(*)::int FROM public.produtos p WHERE p.loja_id = l.id AND p.status = 'ativo') AS anuncios_ativos,
           (SELECT count(*)::int FROM public.denuncias d
            WHERE d.status = 'aberta' AND (
              (d.alvo_tipo IN ('anuncio', 'perfil', 'resposta', 'mensagem') AND d.loja_id = l.id)
              OR (d.alvo_tipo = 'pergunta' AND EXISTS (
                    SELECT 1 FROM public.perguntas q WHERE q.id = d.pergunta_id AND q.autor_id = u.id))
              OR (d.alvo_tipo = 'avaliacao' AND EXISTS (
                    SELECT 1 FROM public.avaliacoes a WHERE a.id = d.avaliacao_id AND a.autor_id = u.id))
            )) AS denuncias_abertas
    FROM public.usuarios u
    LEFT JOIN public.instituicoes i ON i.id = u.instituicoes_id
    LEFT JOIN LATERAL (SELECT lj.id FROM public.lojas lj WHERE lj.usuario_id = u.id ORDER BY lj.id LIMIT 1) l ON TRUE
  ),
  buscados AS (
    SELECT * FROM base b
    WHERE v_padrao IS NULL
       OR (b.nome || ' ' || COALESCE(b.sobrenome, '') || ' ' || COALESCE(b.email, '') || ' ' || COALESCE(b.instituicao_nome, ''))
          ILIKE v_padrao
  ),
  filtrados AS (
    SELECT * FROM buscados b
    WHERE v_filtro = 'todas'
       OR (v_filtro = 'denuncias' AND b.denuncias_abertas > 0)
       OR b.situacao = v_filtro
  )
  SELECT jsonb_build_object(
    'itens', COALESCE((
      SELECT jsonb_agg(to_jsonb(f) - 'situacao' ORDER BY f.id DESC)
      FROM (SELECT * FROM filtrados ORDER BY id DESC OFFSET (v_pagina - 1) * v_por_pagina LIMIT v_por_pagina) f
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtrados),
    'pagina', v_pagina,
    'por_pagina', v_por_pagina,
    'contagens', (
      SELECT jsonb_build_object(
        'todas', count(*),
        'ativa', count(*) FILTER (WHERE situacao = 'ativa'),
        'suspensa', count(*) FILTER (WHERE situacao = 'suspensa'),
        'bloqueada', count(*) FILTER (WHERE situacao = 'bloqueada'),
        'denuncias', count(*) FILTER (WHERE denuncias_abertas > 0)
      ) FROM buscados
    )
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_lojas_pagina(p_status text DEFAULT NULL, p_busca text DEFAULT NULL, p_pagina integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por_pagina CONSTANT integer := 20;
  v_pagina integer := GREATEST(COALESCE(p_pagina, 1), 1);
  v_padrao text := public.padrao_busca_admin(p_busca);
  v_resultado jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('pendente', 'ativo', 'pausado', 'reprovado') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  WITH buscados AS (
    SELECT l.id, l.nome, l.slug, l.status, l.criado_em, l.avatar_url,
           u.id AS usuario_id, trim(u.nome || ' ' || COALESCE(u.sobrenome, '')) AS dono_nome, u.email AS dono_email,
           u.matricula_validada
    FROM public.lojas l
    JOIN public.usuarios u ON u.id = l.usuario_id
    WHERE v_padrao IS NULL
       OR (l.nome || ' ' || u.nome || ' ' || COALESCE(u.sobrenome, '') || ' ' || COALESCE(u.email, '')) ILIKE v_padrao
  ),
  filtrados AS (
    SELECT * FROM buscados WHERE p_status IS NULL OR status = p_status
  )
  SELECT jsonb_build_object(
    'itens', COALESCE((
      SELECT jsonb_agg(to_jsonb(f) || jsonb_build_object(
               'total_produtos', (SELECT count(*) FROM public.produtos p WHERE p.loja_id = f.id),
               'produtos_ativos', (SELECT count(*) FROM public.produtos p WHERE p.loja_id = f.id AND p.status = 'ativo'),
               'produtos_vendidos', (SELECT count(*) FROM public.produtos p WHERE p.loja_id = f.id AND p.status = 'vendido'),
               'total_interesses', (SELECT count(*) FROM public.interesses i WHERE i.loja_id = f.id)
             ) ORDER BY f.id DESC)
      FROM (SELECT * FROM filtrados ORDER BY id DESC OFFSET (v_pagina - 1) * v_por_pagina LIMIT v_por_pagina) f
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtrados),
    'pagina', v_pagina,
    'por_pagina', v_por_pagina,
    'contagens', (
      SELECT jsonb_build_object(
        'todos', count(*),
        'ativo', count(*) FILTER (WHERE status = 'ativo'),
        'pendente', count(*) FILTER (WHERE status = 'pendente'),
        'pausado', count(*) FILTER (WHERE status = 'pausado'),
        'reprovado', count(*) FILTER (WHERE status = 'reprovado')
      ) FROM buscados
    )
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_produtos_pagina(p_destaque boolean DEFAULT false, p_busca text DEFAULT NULL, p_pagina integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por_pagina CONSTANT integer := 20;
  v_pagina integer := GREATEST(COALESCE(p_pagina, 1), 1);
  v_padrao text := public.padrao_busca_admin(p_busca);
  v_resultado jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH filtrados AS (
    SELECT p.id, p.nome, p.preco, p.imagem_url, p.status, p.destaque, p.loja_id, l.nome AS loja_nome, p.criado_em
    FROM public.produtos p
    JOIN public.lojas l ON l.id = p.loja_id
    WHERE (NOT COALESCE(p_destaque, false) OR p.destaque)
      AND (v_padrao IS NULL OR (p.nome || ' ' || l.nome) ILIKE v_padrao)
  )
  SELECT jsonb_build_object(
    'itens', COALESCE((
      SELECT jsonb_agg(to_jsonb(f) - 'criado_em' ORDER BY f.destaque DESC, f.criado_em DESC, f.id DESC)
      FROM (SELECT * FROM filtrados ORDER BY destaque DESC, criado_em DESC, id DESC
            OFFSET (v_pagina - 1) * v_por_pagina LIMIT v_por_pagina) f
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtrados),
    'pagina', v_pagina,
    'por_pagina', v_por_pagina,
    'total_destaques', (SELECT count(*) FROM public.produtos WHERE destaque)
  ) INTO v_resultado;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION
  public.admin_contas_pagina(text, text, integer),
  public.admin_lojas_pagina(text, text, integer),
  public.admin_produtos_pagina(boolean, text, integer)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.admin_contas_pagina(text, text, integer),
  public.admin_lojas_pagina(text, text, integer),
  public.admin_produtos_pagina(boolean, text, integer)
TO authenticated;

COMMIT;
