-- Migração 29: nome de usuário escolhido pelo aluno (lojas.slug), usado no link do perfil /perfil/{usuario}
--
-- 1. Regra username_formato_valido(): 3 a 30 caracteres, a-z 0-9 e . _ - entre letras/números, não só número.
--    Vira o CHECK de lojas.slug (os slugs atuais, inclusive aluno-<id>, já cabem). Espelho: src/lib/username.ts.
-- 2. lojas_slugs_antigos: endereços anteriores continuam levando ao perfil (QR code impresso não quebra)
--    e ninguém mais pode usá-los. Só via RPC.
-- 3. username_disponivel(p_username): motivo em texto se não pode usar, NULL se pode (checagem ao digitar).
-- 4. definir_username(p_username): troca o próprio nome de usuário. A primeira troca é livre; depois,
--    uma vez a cada 30 dias (lojas.username_alterado_em). Bloqueia aluno-<número> (padrão do cadastro)
--    e termos reservados à equipe.
-- 5. perfil_leitura devolve {"redirecionar": slug_atual} quando recebe um endereço antigo;
--    resumo_loja_compartilhada (login do QR code) aceita o endereço antigo.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Formato
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.username_formato_valido(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_username IS NOT NULL
    AND char_length(p_username) BETWEEN 3 AND 30
    AND p_username ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    AND p_username !~ '^[0-9]+$';
$$;
-- Usada no CHECK, que roda com a permissão de quem grava: authenticated precisa de EXECUTE
-- (o cadastro grava pela função de signup, como dono; service_role já recebe por padrão do Supabase)
REVOKE ALL ON FUNCTION public.username_formato_valido(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.username_formato_valido(TEXT) TO authenticated;

ALTER TABLE public.lojas DROP CONSTRAINT IF EXISTS lojas_slug_formato;
ALTER TABLE public.lojas ADD CONSTRAINT lojas_slug_formato CHECK (slug IS NULL OR public.username_formato_valido(slug));

ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS username_alterado_em TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2) Endereços antigos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lojas_slugs_antigos (
  slug TEXT PRIMARY KEY,
  loja_id INT NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lojas_slugs_antigos_loja_idx ON public.lojas_slugs_antigos (loja_id);
ALTER TABLE public.lojas_slugs_antigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lojas_slugs_antigos FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Disponibilidade (motivo ou NULL)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION privado.motivo_username_indisponivel(p_username TEXT, p_loja_id INT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.username_formato_valido(p_username) THEN
    RETURN 'Use de 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado, com pelo menos uma letra.';
  END IF;
  IF p_username ~ '^aluno-[0-9]+$' THEN
    RETURN 'Esse formato é reservado aos perfis novos. Escolha outro nome.';
  END IF;
  IF p_username ~ '(circular|admin|modera|suporte|oficial|equipe)' THEN
    RETURN 'Esse nome usa um termo reservado à equipe do Circular (como Circular, Admin, Suporte ou Oficial).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lojas WHERE slug = p_username AND id IS DISTINCT FROM p_loja_id)
     OR EXISTS (SELECT 1 FROM public.lojas_slugs_antigos WHERE slug = p_username AND loja_id IS DISTINCT FROM p_loja_id) THEN
    RETURN 'Esse nome de usuário já está em uso. Tente outro.';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION privado.motivo_username_indisponivel(TEXT, INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.username_disponivel(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_loja FROM public.lojas WHERE usuario_id = public.meu_usuario_id();
  RETURN privado.motivo_username_indisponivel(lower(trim(COALESCE(p_username, ''))), v_loja);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Trocar o próprio nome de usuário
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.definir_username(p_username TEXT)
RETURNS TEXT -- o nome de usuário gravado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.exigir_aluno_ativo();
  v_novo TEXT := lower(trim(regexp_replace(COALESCE(p_username, ''), '^\s*@+', '')));
  v_loja public.lojas%ROWTYPE;
  v_motivo TEXT;
  v_proxima TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_loja FROM public.lojas WHERE usuario_id = v_usuario FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado.' USING ERRCODE = 'PT404';
  END IF;
  IF v_novo = v_loja.slug THEN
    RETURN v_novo;
  END IF;

  v_motivo := privado.motivo_username_indisponivel(v_novo, v_loja.id);
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION '%', v_motivo USING ERRCODE = '22023';
  END IF;

  v_proxima := v_loja.username_alterado_em + interval '30 days';
  IF v_proxima > now() THEN
    RAISE EXCEPTION 'Você pode trocar o nome de usuário de novo a partir de %.',
      to_char(v_proxima AT TIME ZONE 'America/Bahia', 'DD/MM/YYYY') USING ERRCODE = 'PT429';
  END IF;

  -- O endereço atual vira antigo (continua levando ao perfil); o novo sai da lista se era um antigo do próprio aluno
  INSERT INTO public.lojas_slugs_antigos (slug, loja_id) VALUES (v_loja.slug, v_loja.id) ON CONFLICT (slug) DO NOTHING;
  DELETE FROM public.lojas_slugs_antigos WHERE slug = v_novo AND loja_id = v_loja.id;

  BEGIN
    UPDATE public.lojas SET slug = v_novo, username_alterado_em = now() WHERE id = v_loja.id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Esse nome de usuário já está em uso. Tente outro.' USING ERRCODE = '22023';
  END;

  RETURN v_novo;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Endereço antigo leva ao atual
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
  v_atual TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para ver perfis' USING ERRCODE = '42501';
  END IF;
  v_meu_campus := public.meu_campus_id();
  v_meu_id := public.meu_usuario_id();

  IF p_id_ou_slug ~ '^[0-9]{1,9}$' THEN
    SELECT * INTO v_loja FROM public.lojas WHERE id = p_id_ou_slug::int AND status = 'ativo';
  ELSE
    SELECT * INTO v_loja FROM public.lojas WHERE slug = lower(p_id_ou_slug) AND status = 'ativo';
    IF NOT FOUND THEN
      SELECT l.slug INTO v_atual
      FROM public.lojas_slugs_antigos a
      JOIN public.lojas l ON l.id = a.loja_id
      WHERE a.slug = lower(p_id_ou_slug) AND l.status = 'ativo';
      IF v_atual IS NOT NULL THEN
        RETURN jsonb_build_object('redirecionar', v_atual);
      END IF;
    END IF;
  END IF;
  IF v_loja.id IS NULL THEN
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

CREATE OR REPLACE FUNCTION public.resumo_loja_compartilhada(p_slug text, p_codigo text)
RETURNS TABLE(loja_nome text, instituicao_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT l.nome::text, i.nome::text
  FROM public.lojas l
  JOIN public.usuarios u ON u.id = l.usuario_id
  LEFT JOIN public.instituicoes i ON i.id = u.instituicoes_id
  WHERE (l.slug = lower(p_slug)
         OR l.id = (SELECT a.loja_id FROM public.lojas_slugs_antigos a WHERE a.slug = lower(p_slug)))
    AND l.codigo_compartilhamento = p_codigo
    AND l.status = 'ativo'
    AND u.status = 'ativo';
$function$;

-- ---------------------------------------------------------------------------
-- 6) Permissões
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.username_disponivel(TEXT), public.definir_username(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.username_disponivel(TEXT), public.definir_username(TEXT) TO authenticated;

COMMIT;
