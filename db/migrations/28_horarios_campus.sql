-- Migração 28: dias e horários em que o aluno está no campus (para combinar entregas)
--
-- 1. lojas.horarios (jsonb): lista de faixas {"dia": 0-6 (0 = domingo), "inicio": "HH:MM", "fim": "HH:MM"}.
--    Regra horarios_validos(): até 14 faixas, início antes do fim, sem faixas sobrepostas no mesmo dia.
--    Espelho no cliente: problemaHorarios (src/lib/horarios.ts) — mudar os dois juntos.
-- 2. O dono lê e grava pela API (GRANT de coluna, como locais_entrega).
-- 3. perfil_leitura() e anuncio_leitura() passam a devolver horarios (o resto igual à migração 26).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Regra e coluna
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.horarios_validos(p_horarios JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
BEGIN
  IF p_horarios IS NULL OR jsonb_typeof(p_horarios) <> 'array' THEN
    RETURN FALSE;
  END IF;
  IF jsonb_array_length(p_horarios) > 14 THEN
    RETURN FALSE;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_horarios) LOOP
    -- Tipo primeiro, num IF separado: jsonb_object_keys falha em item que não é objeto
    IF jsonb_typeof(v_item) <> 'object' THEN
      RETURN FALSE;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(v_item)) <> 3
       OR jsonb_typeof(v_item -> 'dia') <> 'number'
       OR (v_item ->> 'dia') !~ '^[0-6]$'
       OR jsonb_typeof(v_item -> 'inicio') <> 'string'
       OR jsonb_typeof(v_item -> 'fim') <> 'string'
       OR (v_item ->> 'inicio') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR (v_item ->> 'fim') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       OR (v_item ->> 'inicio') >= (v_item ->> 'fim') THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  -- Sem sobreposição no mesmo dia (encostar pode: 08:00–12:00 e 12:00–14:00)
  RETURN NOT EXISTS (
    SELECT 1
    FROM (
      SELECT e ->> 'inicio' AS inicio,
             lag(e ->> 'fim') OVER (PARTITION BY e ->> 'dia' ORDER BY e ->> 'inicio') AS fim_anterior
      FROM jsonb_array_elements(p_horarios) e
    ) s
    WHERE s.fim_anterior IS NOT NULL AND s.inicio < s.fim_anterior
  );
END;
$$;

ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS horarios JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.lojas DROP CONSTRAINT IF EXISTS lojas_horarios_validos;
ALTER TABLE public.lojas ADD CONSTRAINT lojas_horarios_validos CHECK (public.horarios_validos(horarios));

-- Função pura (SECURITY INVOKER) do CHECK. O CHECK roda com a permissão de quem grava, então
-- authenticated precisa de EXECUTE; anon não grava lojas
REVOKE ALL ON FUNCTION public.horarios_validos(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.horarios_validos(JSONB) TO authenticated;

GRANT SELECT (horarios), UPDATE (horarios) ON public.lojas TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Leitura do perfil com horarios
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perfil_leitura(p_id_ou_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meu_campus INT;
  v_meu_id INT;
  v_loja public.lojas%ROWTYPE;
  v_usuario public.usuarios%ROWTYPE;
  v_instituicao TEXT;
  v_eh_dono BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver perfis' USING ERRCODE = '42501';
  END IF;
  v_meu_campus := public.meu_campus_id();
  v_meu_id := public.meu_usuario_id();

  IF p_id_ou_slug ~ '^[0-9]{1,9}$' THEN
    SELECT * INTO v_loja FROM public.lojas WHERE id = p_id_ou_slug::int AND status = 'ativo';
  ELSE
    SELECT * INTO v_loja FROM public.lojas WHERE slug = p_id_ou_slug AND status = 'ativo';
  END IF;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_usuario FROM public.usuarios WHERE id = v_loja.usuario_id;
  SELECT nome INTO v_instituicao FROM public.instituicoes WHERE id = v_usuario.instituicoes_id;
  v_eh_dono := v_loja.usuario_id = v_meu_id;

  RETURN jsonb_build_object(
    'mesmo_campus', COALESCE(v_usuario.instituicoes_id = v_meu_campus, FALSE),
    'eh_dono', COALESCE(v_eh_dono, FALSE),
    'tem_whatsapp', COALESCE(length(v_loja.contato) >= 12, FALSE),
    'codigo_compartilhamento', v_loja.codigo_compartilhamento,
    'perfil', jsonb_build_object(
      'id', v_loja.id,
      'usuario_id', v_loja.usuario_id,
      'nome', v_loja.nome,
      'descricao', COALESCE(v_loja.descricao, ''),
      'status', v_loja.status,
      'criado_em', v_loja.criado_em,
      'avatar_url', v_loja.avatar_url,
      'capa_url', v_loja.capa_url,
      'slug', v_loja.slug,
      'instagram_url', v_loja.instagram_url,
      'tiktok_url', v_loja.tiktok_url,
      'locais_entrega', COALESCE(to_jsonb(v_loja.locais_entrega), '[]'::jsonb),
      'horarios', COALESCE(v_loja.horarios, '[]'::jsonb),
      'usuario_criado_em', v_usuario.criado_em,
      'matricula_status', v_usuario.matricula_status,
      'instituicao_nome', v_instituicao
    ),
    'produtos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'loja_id', p.loja_id,
        'nome', p.nome,
        'descricao', p.descricao,
        'preco', p.preco,
        'imagem_url', p.imagem_url,
        'categoria_id', p.categoria_id,
        'categoria_nome', c.nome,
        'loja_nome', v_loja.nome,
        'loja_descricao', v_loja.descricao,
        'loja_avatar_url', v_loja.avatar_url,
        'destaque', p.destaque,
        'aceita_troca', p.aceita_troca,
        'loja_verificada', v_usuario.matricula_status = 'verificado'
      ) ORDER BY p.criado_em DESC)
      FROM public.produtos p
      JOIN public.categorias c ON c.id = p.categoria_id
      WHERE p.loja_id = v_loja.id
        AND p.status = 'ativo'
        AND p.renovado_em > now() - interval '60 days'
    ), '[]'::jsonb)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3) Leitura do anúncio com horarios do vendedor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anuncio_leitura(p_id integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meu_id INT;
  v_meu_campus INT;
  v_produto public.produtos%ROWTYPE;
  v_loja public.lojas%ROWTYPE;
  v_usuario public.usuarios%ROWTYPE;
  v_categoria TEXT;
  v_instituicao TEXT;
  v_eh_dono BOOLEAN;
  v_disponivel BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver anúncios' USING ERRCODE = '42501';
  END IF;
  v_meu_id := public.meu_usuario_id();
  v_meu_campus := public.meu_campus_id();

  SELECT * INTO v_produto FROM public.produtos WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_loja FROM public.lojas WHERE id = v_produto.loja_id;
  SELECT * INTO v_usuario FROM public.usuarios WHERE id = v_loja.usuario_id;

  v_eh_dono := COALESCE(v_loja.usuario_id = v_meu_id, FALSE);
  v_disponivel := v_produto.status = 'ativo'
    AND v_produto.renovado_em > now() - interval '60 days'
    AND v_loja.status = 'ativo';

  IF NOT v_disponivel AND NOT v_eh_dono THEN
    RETURN jsonb_build_object(
      'disponivel', FALSE,
      'eh_dono', FALSE,
      'anuncio', jsonb_build_object('id', v_produto.id, 'nome', v_produto.nome),
      'loja', CASE WHEN v_loja.status = 'ativo'
        THEN jsonb_build_object('slug', v_loja.slug, 'nome', v_loja.nome) END
    );
  END IF;

  SELECT nome INTO v_categoria FROM public.categorias WHERE id = v_produto.categoria_id;
  SELECT nome INTO v_instituicao FROM public.instituicoes WHERE id = v_usuario.instituicoes_id;

  RETURN jsonb_build_object(
    'disponivel', v_disponivel,
    'eh_dono', v_eh_dono,
    'mesmo_campus', COALESCE(v_usuario.instituicoes_id = v_meu_campus, FALSE),
    'tem_whatsapp', COALESCE(length(v_loja.contato) >= 12, FALSE),
    'codigo_compartilhamento', v_loja.codigo_compartilhamento,
    'favoritado', EXISTS (SELECT 1 FROM public.favoritos f WHERE f.usuario_id = v_meu_id AND f.produto_id = v_produto.id),
    'anuncio', jsonb_build_object(
      'id', v_produto.id,
      'nome', v_produto.nome,
      'descricao', v_produto.descricao,
      'preco', v_produto.preco,
      'imagem_url', v_produto.imagem_url,
      'categoria_id', v_produto.categoria_id,
      'categoria_nome', v_categoria,
      'aceita_troca', v_produto.aceita_troca,
      'destaque', v_produto.destaque,
      'status', v_produto.status,
      'criado_em', v_produto.criado_em,
      'renovado_em', v_produto.renovado_em
    ),
    'loja', jsonb_build_object(
      'id', v_loja.id,
      'slug', v_loja.slug,
      'nome', v_loja.nome,
      'descricao', v_loja.descricao,
      'avatar_url', v_loja.avatar_url,
      'locais_entrega', COALESCE(to_jsonb(v_loja.locais_entrega), '[]'::jsonb),
      'horarios', COALESCE(v_loja.horarios, '[]'::jsonb),
      'verificada', v_usuario.matricula_status = 'verificado',
      'instituicao_nome', v_instituicao
    ),
    'outros', COALESCE((
      SELECT jsonb_agg(o ORDER BY (o->>'criado_em') DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', p.id,
          'loja_id', p.loja_id,
          'nome', p.nome,
          'descricao', p.descricao,
          'preco', p.preco,
          'imagem_url', p.imagem_url,
          'categoria_id', p.categoria_id,
          'categoria_nome', c.nome,
          'loja_nome', v_loja.nome,
          'loja_descricao', v_loja.descricao,
          'loja_avatar_url', v_loja.avatar_url,
          'destaque', p.destaque,
          'aceita_troca', p.aceita_troca,
          'loja_verificada', v_usuario.matricula_status = 'verificado',
          'criado_em', p.criado_em
        ) AS o
        FROM public.produtos p
        JOIN public.categorias c ON c.id = p.categoria_id
        WHERE p.loja_id = v_loja.id
          AND p.id <> v_produto.id
          AND p.status = 'ativo'
          AND p.renovado_em > now() - interval '60 days'
          AND v_loja.status = 'ativo'
        ORDER BY p.criado_em DESC
        LIMIT 8
      ) s
    ), '[]'::jsonb)
  );
END;
$function$;

COMMIT;
