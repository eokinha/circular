-- Migração 31: canal de suporte (chamados do aluno com a equipe)
--
-- O aluno abre um chamado em /painel/suporte e conversa com a equipe por ali; a equipe responde em /admin/suporte.
-- O e-mail (Resend, rotas /api/suporte/*) só formaliza: protocolo na abertura, aviso a cada resposta e resumo no fim.
--
-- - chamados / chamado_mensagens: tabelas próprias (conversas exige anúncio, loja e vendedor). Escrita e leitura
--   só por RPC SECURITY DEFINER; sem grant de tabela para anon/authenticated.
-- - Conta suspensa ou bloqueada também abre e acompanha chamado (é o caso mais comum): as RPCs do aluno usam
--   meu_usuario_id(), não exigir_aluno_ativo().
-- - O aluno nunca vê qual admin respondeu: a mensagem só diz de_equipe (o JSON não leva autor_id).
-- - Tempo real: o trigger publica cada mensagem no canal privado chamado:{uuid} (dono do chamado ou admin;
--   pode_usar_topico_realtime ganha esse tópico). Espelho do nome: topicoChamado em src/lib/chat.ts.
-- - Limites: até 3 chamados não resolvidos e 5 abertos por dia por aluno; 10 mensagens por minuto e 100 por dia.
--   Chamado resolvido não recebe mensagem do aluno (abre outro); resposta da equipe reabre.
-- - Retenção: chamado resolvido é apagado 180 dias depois (privado.config retencao_chamados_dias);
--   a exclusão de conta guarda os chamados na cópia de privado.conteudo_retido (30 dias).

BEGIN;

INSERT INTO privado.config (chave, valor) VALUES ('retencao_chamados_dias', '180')
ON CONFLICT (chave) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1) Tabelas
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.chamados_protocolo_seq;

CREATE TABLE IF NOT EXISTS public.chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE DEFAULT (
    'CIR-' || to_char(now() AT TIME ZONE 'America/Bahia', 'YYYY') || '-'
    || lpad(nextval('public.chamados_protocolo_seq')::text, 5, '0')
  ),
  usuario_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  categoria text NOT NULL CONSTRAINT chamados_categoria_valida
    CHECK (categoria IN ('conta', 'acesso', 'anuncio', 'negociacao', 'privacidade', 'outro')),
  assunto text NOT NULL CONSTRAINT chamados_assunto_tamanho CHECK (char_length(btrim(assunto)) BETWEEN 5 AND 120),
  status text NOT NULL DEFAULT 'aberto' CONSTRAINT chamados_status_valido
    CHECK (status IN ('aberto', 'em_atendimento', 'resolvido')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  CONSTRAINT chamados_resolvido_coerente CHECK ((status = 'resolvido') = (resolvido_em IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS chamados_usuario_idx ON public.chamados (usuario_id, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS chamados_fila_idx ON public.chamados (status, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS chamados_resolvido_idx ON public.chamados (resolvido_em) WHERE status = 'resolvido';

CREATE TABLE IF NOT EXISTS public.chamado_mensagens (
  id bigserial PRIMARY KEY,
  chamado_id uuid NOT NULL REFERENCES public.chamados(id) ON DELETE CASCADE,
  autor_id integer REFERENCES public.usuarios(id) ON DELETE SET NULL,
  de_equipe boolean NOT NULL DEFAULT false,
  texto text NOT NULL CONSTRAINT chamado_mensagens_texto_tamanho CHECK (char_length(btrim(texto)) BETWEEN 1 AND 2000),
  cliente_id uuid NOT NULL UNIQUE,            -- gerado no navegador: reenvio não duplica
  criado_em timestamptz NOT NULL DEFAULT now(),
  lida_em timestamptz
);
CREATE INDEX IF NOT EXISTS chamado_mensagens_chamado_idx ON public.chamado_mensagens (chamado_id, id);
CREATE INDEX IF NOT EXISTS chamado_mensagens_autor_idx ON public.chamado_mensagens (autor_id, criado_em);
CREATE INDEX IF NOT EXISTS chamado_mensagens_nao_lidas_idx ON public.chamado_mensagens (chamado_id) WHERE lida_em IS NULL;

ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamado_mensagens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chamados, public.chamado_mensagens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.chamados_protocolo_seq, public.chamado_mensagens_id_seq FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Helpers internos
-- ---------------------------------------------------------------------------

-- Dono do chamado ou admin
CREATE OR REPLACE FUNCTION public.participa_do_chamado(p_chamado_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chamados c WHERE c.id = p_chamado_id AND c.usuario_id = public.meu_usuario_id()
  ) OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.chamado_mensagem_json(m public.chamado_mensagens)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', m.id, 'chamado_id', m.chamado_id, 'de_equipe', m.de_equipe, 'texto', m.texto,
    'cliente_id', m.cliente_id, 'criado_em', m.criado_em, 'lida_em', m.lida_em
  );
$$;

-- p_lado_equipe: quem lê é a equipe (não lidas = mensagens do aluno) ou o aluno (não lidas = da equipe)
CREATE OR REPLACE FUNCTION public.chamado_json(c public.chamados, p_lado_equipe boolean)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id, 'protocolo', c.protocolo, 'categoria', c.categoria, 'assunto', c.assunto, 'status', c.status,
    'criado_em', c.criado_em, 'atualizado_em', c.atualizado_em, 'resolvido_em', c.resolvido_em,
    'ultima', (
      SELECT jsonb_build_object('texto', left(m.texto, 140), 'de_equipe', m.de_equipe, 'criado_em', m.criado_em)
      FROM public.chamado_mensagens m WHERE m.chamado_id = c.id ORDER BY m.id DESC LIMIT 1
    ),
    'nao_lidas', (
      SELECT count(*) FROM public.chamado_mensagens m
      WHERE m.chamado_id = c.id AND m.de_equipe <> p_lado_equipe AND m.lida_em IS NULL
    )
  );
$$;

-- Quem é o aluno do chamado (só nas RPCs de admin)
CREATE OR REPLACE FUNCTION public.chamado_aluno_json(p_usuario_id integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', u.id, 'nome', trim(u.nome || ' ' || COALESCE(u.sobrenome, '')), 'nome_publico', l.nome, 'slug', l.slug,
    'instituicao', i.nome, 'conta_status', u.status, 'bloqueado_ate', u.bloqueado_ate
  )
  FROM public.usuarios u
  LEFT JOIN public.lojas l ON l.usuario_id = u.id
  LEFT JOIN public.instituicoes i ON i.id = u.instituicoes_id
  WHERE u.id = p_usuario_id;
$$;

-- Dados do e-mail de atendimento (só para a rota /api da equipe montar o aviso ao aluno)
CREATE OR REPLACE FUNCTION public.chamado_aviso_email(c public.chamados)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'para', u.email, 'nome', u.nome, 'protocolo', c.protocolo, 'assunto', c.assunto, 'categoria', c.categoria,
    'chamado_id', c.id, 'criado_em', c.criado_em, 'resolvido_em', c.resolvido_em
  )
  FROM public.usuarios u WHERE u.id = c.usuario_id;
$$;

REVOKE ALL ON FUNCTION
  public.participa_do_chamado(uuid),
  public.chamado_mensagem_json(public.chamado_mensagens),
  public.chamado_json(public.chamados, boolean),
  public.chamado_aluno_json(integer),
  public.chamado_aviso_email(public.chamados)
FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Tempo real: canal privado chamado:{uuid}
-- ---------------------------------------------------------------------------

-- Igual à migração 26 + chamado:{uuid} (só leitura; só o banco publica)
CREATE OR REPLACE FUNCTION public.pode_usar_topico_realtime(p_topico text, p_escrita boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partes TEXT[] := string_to_array(COALESCE(p_topico, ''), ':');
  v_uuid CONSTANT TEXT := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF v_partes[1] = 'conversa' AND v_partes[2] ~ v_uuid THEN
    IF array_length(v_partes, 1) = 2 THEN
      RETURN NOT p_escrita AND public.participa_da_conversa(v_partes[2]::uuid);
    ELSIF array_length(v_partes, 1) = 3 AND v_partes[3] = 'digitando' THEN
      RETURN public.participa_da_conversa(v_partes[2]::uuid);
    END IF;
  ELSIF v_partes[1] = 'usuario' AND array_length(v_partes, 1) = 2 THEN
    RETURN NOT p_escrita AND v_partes[2] = public.meu_usuario_id()::text;
  ELSIF v_partes[1] = 'chamado' AND array_length(v_partes, 1) = 2 AND v_partes[2] ~ v_uuid THEN
    RETURN NOT p_escrita AND public.participa_do_chamado(v_partes[2]::uuid);
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.publicar_mensagem_chamado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.send(public.chamado_mensagem_json(NEW), 'mensagem', 'chamado:' || NEW.chamado_id, true);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.publicar_mensagem_chamado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chamado_mensagens_publicar ON public.chamado_mensagens;
CREATE TRIGGER chamado_mensagens_publicar AFTER INSERT ON public.chamado_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.publicar_mensagem_chamado();

-- ---------------------------------------------------------------------------
-- 4) RPCs do aluno (conta suspensa ou bloqueada também usa)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.abrir_chamado(p_categoria text, p_assunto text, p_texto text, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.meu_usuario_id();
  v_assunto TEXT := btrim(COALESCE(p_assunto, ''));
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_chamado public.chamados%ROWTYPE;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar' USING ERRCODE = '42501';
  END IF;

  -- Reenvio do mesmo formulário (rede caiu antes da resposta): devolve o chamado já aberto
  SELECT c.* INTO v_chamado
  FROM public.chamado_mensagens m JOIN public.chamados c ON c.id = m.chamado_id
  WHERE m.cliente_id = p_cliente_id;
  IF FOUND THEN
    IF v_chamado.usuario_id <> v_usuario THEN
      RAISE EXCEPTION 'Pedido inválido.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('chamado', public.chamado_json(v_chamado, false), 'novo', false);
  END IF;

  IF p_categoria IS NULL OR p_categoria NOT IN ('conta', 'acesso', 'anuncio', 'negociacao', 'privacidade', 'outro') THEN
    RAISE EXCEPTION 'Escolha o assunto do chamado.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_assunto) NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'O título precisa ter de 5 a 120 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_texto) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Conte o que aconteceu em 10 a 2000 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.chamados WHERE usuario_id = v_usuario AND status <> 'resolvido') >= 3 THEN
    RAISE EXCEPTION 'Você já tem 3 chamados em andamento. Continue a conversa em um deles.' USING ERRCODE = 'PT429';
  END IF;
  IF (SELECT count(*) FROM public.chamados WHERE usuario_id = v_usuario AND criado_em > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'Você abriu muitos chamados hoje. Continue a conversa nos que já existem.' USING ERRCODE = 'PT429';
  END IF;

  INSERT INTO public.chamados (usuario_id, categoria, assunto)
  VALUES (v_usuario, p_categoria, v_assunto)
  RETURNING * INTO v_chamado;
  INSERT INTO public.chamado_mensagens (chamado_id, autor_id, de_equipe, texto, cliente_id)
  VALUES (v_chamado.id, v_usuario, false, v_texto, p_cliente_id);

  PERFORM privado.registrar_acesso(v_usuario, 'suporte');
  RETURN jsonb_build_object(
    'chamado', public.chamado_json(v_chamado, false),
    'novo', true,
    'meu_nome', (SELECT trim(nome || ' ' || COALESCE(sobrenome, '')) FROM public.usuarios WHERE id = v_usuario)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enviar_mensagem_chamado(p_chamado_id uuid, p_texto text, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.meu_usuario_id();
  v_chamado public.chamados%ROWTYPE;
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_msg public.chamado_mensagens%ROWTYPE;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_chamado FROM public.chamados WHERE id = p_chamado_id AND usuario_id = v_usuario;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO v_msg FROM public.chamado_mensagens WHERE cliente_id = p_cliente_id;
  IF FOUND THEN
    IF v_msg.autor_id IS DISTINCT FROM v_usuario OR v_msg.chamado_id <> p_chamado_id THEN
      RAISE EXCEPTION 'Mensagem inválida.' USING ERRCODE = '22023';
    END IF;
    RETURN public.chamado_mensagem_json(v_msg);
  END IF;

  IF v_chamado.status = 'resolvido' THEN
    RAISE EXCEPTION 'Este atendimento foi encerrado. Se precisar, abra um novo chamado.' USING ERRCODE = 'PT403';
  END IF;
  IF char_length(v_texto) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'A mensagem precisa ter de 1 a 2000 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.chamado_mensagens WHERE autor_id = v_usuario AND NOT de_equipe
        AND criado_em > now() - interval '1 minute') >= 10
     OR (SELECT count(*) FROM public.chamado_mensagens WHERE autor_id = v_usuario AND NOT de_equipe
        AND criado_em > now() - interval '1 day') >= 100 THEN
    RAISE EXCEPTION 'Você enviou muitas mensagens em pouco tempo. Espere um pouco.' USING ERRCODE = 'PT429';
  END IF;

  INSERT INTO public.chamado_mensagens (chamado_id, autor_id, de_equipe, texto, cliente_id)
  VALUES (p_chamado_id, v_usuario, false, v_texto, p_cliente_id)
  RETURNING * INTO v_msg;
  UPDATE public.chamados SET atualizado_em = v_msg.criado_em WHERE id = p_chamado_id;

  PERFORM privado.registrar_acesso(v_usuario, 'suporte');
  RETURN public.chamado_mensagem_json(v_msg);
END;
$$;

CREATE OR REPLACE FUNCTION public.meus_chamados()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.meu_usuario_id();
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.chamado_json(c, false) ORDER BY c.status = 'resolvido', c.atualizado_em DESC)
    FROM (SELECT * FROM public.chamados WHERE usuario_id = v_usuario ORDER BY atualizado_em DESC LIMIT 50) c
  ), '[]'::jsonb);
END;
$$;

-- Chamado + mensagens (até as 300 últimas; atendimento costuma ser curto). null = não existe ou não é do aluno
CREATE OR REPLACE FUNCTION public.chamado_leitura(p_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.meu_usuario_id();
  v_chamado public.chamados%ROWTYPE;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_chamado FROM public.chamados WHERE id = p_chamado_id AND usuario_id = v_usuario;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN public.chamado_json(v_chamado, false) || jsonb_build_object(
    'mensagens', COALESCE((
      SELECT jsonb_agg(public.chamado_mensagem_json(m) ORDER BY m.id)
      FROM (SELECT * FROM public.chamado_mensagens WHERE chamado_id = p_chamado_id ORDER BY id DESC LIMIT 300) m
    ), '[]'::jsonb)
  );
END;
$$;

-- Reconexão do Realtime (aluno ou equipe): o que chegou depois do último id visto
CREATE OR REPLACE FUNCTION public.mensagens_do_chamado(p_chamado_id uuid, p_depois bigint DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.participa_do_chamado(p_chamado_id) THEN
    RAISE EXCEPTION 'Chamado não encontrado.' USING ERRCODE = 'PT404';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(public.chamado_mensagem_json(m) ORDER BY m.id)
    FROM (SELECT * FROM public.chamado_mensagens
          WHERE chamado_id = p_chamado_id AND id > COALESCE(p_depois, 0) ORDER BY id LIMIT 200) m
  ), '[]'::jsonb);
END;
$$;

-- Dono marca as mensagens da equipe; admin (que não é o dono) marca as do aluno
CREATE OR REPLACE FUNCTION public.marcar_chamado_lido(p_chamado_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.meu_usuario_id();
  v_dono INT;
BEGIN
  SELECT usuario_id INTO v_dono FROM public.chamados WHERE id = p_chamado_id;
  IF v_usuario IS NULL OR v_dono IS NULL OR (v_dono <> v_usuario AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'Chamado não encontrado.' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public.chamado_mensagens SET lida_em = now()
  WHERE chamado_id = p_chamado_id AND lida_em IS NULL AND de_equipe = (v_dono = v_usuario);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPCs da equipe (todas exigem is_admin)
-- ---------------------------------------------------------------------------

-- Fila: p_status NULL = todos. Não resolvidos primeiro, os com mensagem do aluno sem leitura no topo
CREATE OR REPLACE FUNCTION public.admin_listar_chamados(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY (x->>'status') = 'resolvido', (x->>'nao_lidas')::int > 0 DESC, (x->>'atualizado_em') DESC)
    FROM (
      SELECT public.chamado_json(c, true) || jsonb_build_object('aluno', public.chamado_aluno_json(c.usuario_id)) AS x
      FROM public.chamados c
      WHERE p_status IS NULL OR c.status = p_status
      ORDER BY c.atualizado_em DESC
      LIMIT 200
    ) s
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ler_chamado(p_chamado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_chamado FROM public.chamados WHERE id = p_chamado_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN public.chamado_json(v_chamado, true) || jsonb_build_object(
    'aluno', public.chamado_aluno_json(v_chamado.usuario_id),
    'mensagens', COALESCE((
      SELECT jsonb_agg(public.chamado_mensagem_json(m) ORDER BY m.id)
      FROM (SELECT * FROM public.chamado_mensagens WHERE chamado_id = p_chamado_id ORDER BY id DESC LIMIT 300) m
    ), '[]'::jsonb)
  );
END;
$$;

-- Resposta da equipe: chamado aberto passa a em_atendimento; resolvido é reaberto.
-- Devolve os dados do e-mail de aviso só quando a mensagem é nova (reenvio não manda e-mail de novo).
CREATE OR REPLACE FUNCTION public.admin_responder_chamado(p_chamado_id uuid, p_texto text, p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin INT := public.meu_usuario_id();
  v_chamado public.chamados%ROWTYPE;
  v_texto TEXT := btrim(COALESCE(p_texto, ''));
  v_msg public.chamado_mensagens%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_chamado FROM public.chamados WHERE id = p_chamado_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.' USING ERRCODE = 'PT404';
  END IF;

  SELECT * INTO v_msg FROM public.chamado_mensagens WHERE cliente_id = p_cliente_id;
  IF FOUND THEN
    IF v_msg.chamado_id <> p_chamado_id OR NOT v_msg.de_equipe THEN
      RAISE EXCEPTION 'Mensagem inválida.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('mensagem', public.chamado_mensagem_json(v_msg), 'status', v_chamado.status, 'novo', false);
  END IF;

  IF char_length(v_texto) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'A mensagem precisa ter de 1 a 2000 caracteres.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.chamado_mensagens (chamado_id, autor_id, de_equipe, texto, cliente_id)
  VALUES (p_chamado_id, v_admin, true, v_texto, p_cliente_id)
  RETURNING * INTO v_msg;
  UPDATE public.chamados
  SET atualizado_em = v_msg.criado_em,
      status = 'em_atendimento',
      resolvido_em = NULL
  WHERE id = p_chamado_id
  RETURNING * INTO v_chamado;
  -- Mensagens do aluno até aqui contam como lidas por quem respondeu
  UPDATE public.chamado_mensagens SET lida_em = now()
  WHERE chamado_id = p_chamado_id AND NOT de_equipe AND lida_em IS NULL;

  PERFORM realtime.send(jsonb_build_object('status', v_chamado.status), 'status', 'chamado:' || p_chamado_id, true);
  RETURN jsonb_build_object(
    'mensagem', public.chamado_mensagem_json(v_msg),
    'status', v_chamado.status,
    'novo', true,
    'aviso_email', public.chamado_aviso_email(v_chamado)
  );
END;
$$;

-- Muda o status. Ao resolver, devolve os dados do e-mail de encerramento (com a última resposta da equipe)
CREATE OR REPLACE FUNCTION public.admin_status_chamado(p_chamado_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chamado public.chamados%ROWTYPE;
  v_antes TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('aberto', 'em_atendimento', 'resolvido') THEN
    RAISE EXCEPTION 'Status inválido.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_chamado FROM public.chamados WHERE id = p_chamado_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.' USING ERRCODE = 'PT404';
  END IF;
  v_antes := v_chamado.status;
  IF v_antes = p_status THEN
    RETURN jsonb_build_object('status', p_status, 'resolvido_em', v_chamado.resolvido_em, 'mudou', false);
  END IF;

  UPDATE public.chamados
  SET status = p_status,
      resolvido_em = CASE WHEN p_status = 'resolvido' THEN now() ELSE NULL END,
      atualizado_em = now()
  WHERE id = p_chamado_id
  RETURNING * INTO v_chamado;

  PERFORM realtime.send(jsonb_build_object('status', v_chamado.status), 'status', 'chamado:' || p_chamado_id, true);
  RETURN jsonb_build_object(
    'status', v_chamado.status,
    'resolvido_em', v_chamado.resolvido_em,
    'mudou', true,
    'aviso_email', CASE WHEN p_status = 'resolvido' THEN
      public.chamado_aviso_email(v_chamado) || jsonb_build_object('ultima_resposta', (
        SELECT left(m.texto, 1000) FROM public.chamado_mensagens m
        WHERE m.chamado_id = p_chamado_id AND m.de_equipe ORDER BY m.id DESC LIMIT 1
      ))
    END
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Exclusão de conta (versão da 26 + chamados na cópia) e limpeza diária
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.excluir_minha_conta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario INT := public.meu_usuario_id();
  v_auth UUID := auth.uid();
  v_loja INT;
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Faça login para excluir a conta' USING ERRCODE = '42501';
  END IF;
  IF (SELECT is_admin FROM public.usuarios WHERE id = v_usuario) THEN
    RAISE EXCEPTION 'Contas de administrador não podem ser excluídas por aqui';
  END IF;
  SELECT id INTO v_loja FROM public.lojas WHERE usuario_id = v_usuario;

  PERFORM privado.registrar_acesso(v_usuario, 'conta_excluida');

  INSERT INTO privado.conteudo_retido (usuario_id, email, nome, conteudo, expira_em)
  SELECT u.id, u.email, trim(u.nome || ' ' || COALESCE(u.sobrenome, '')),
    jsonb_build_object(
      'perfil', (SELECT jsonb_build_object('id', l.id, 'nome', l.nome, 'slug', l.slug, 'descricao', l.descricao, 'contato', l.contato)
                 FROM public.lojas l WHERE l.id = v_loja),
      'anuncios', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'descricao', p.descricao,
                                                                'preco', p.preco, 'status', p.status, 'criado_em', p.criado_em))
                            FROM public.produtos p WHERE p.loja_id = v_loja), '[]'::jsonb),
      'perguntas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'produto_id', q.produto_id, 'texto', q.texto, 'criado_em', q.criado_em))
                             FROM public.perguntas q WHERE q.autor_id = v_usuario), '[]'::jsonb),
      'respostas', COALESCE((SELECT jsonb_agg(jsonb_build_object('pergunta_id', q.id, 'resposta', q.resposta, 'respondida_em', q.respondida_em))
                             FROM public.perguntas q JOIN public.produtos p ON p.id = q.produto_id
                             WHERE p.loja_id = v_loja AND q.resposta IS NOT NULL), '[]'::jsonb),
      'avaliacoes', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'loja_id', a.loja_id, 'nota', a.nota,
                                                                  'comentario', a.comentario, 'criado_em', a.criado_em))
                              FROM public.avaliacoes a WHERE a.autor_id = v_usuario), '[]'::jsonb),
      'conversas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                                'id', c.id, 'produto_nome', c.produto_nome, 'comprador_id', c.comprador_id,
                                'vendedor_id', c.vendedor_id, 'criado_em', c.criado_em,
                                'mensagens', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'autor_id', m.autor_id,
                                                                                          'texto', m.texto, 'criado_em', m.criado_em)
                                                                      ORDER BY m.id)
                                                       FROM public.mensagens m WHERE m.conversa_id = c.id), '[]'::jsonb)))
                             FROM public.conversas c WHERE v_usuario IN (c.comprador_id, c.vendedor_id)), '[]'::jsonb),
      'chamados', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'id', ch.id, 'protocolo', ch.protocolo, 'categoria', ch.categoria, 'assunto', ch.assunto,
                               'status', ch.status, 'criado_em', ch.criado_em, 'resolvido_em', ch.resolvido_em,
                               'mensagens', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'de_equipe', m.de_equipe,
                                                                                         'texto', m.texto, 'criado_em', m.criado_em)
                                                                     ORDER BY m.id)
                                                      FROM public.chamado_mensagens m WHERE m.chamado_id = ch.id), '[]'::jsonb)))
                            FROM public.chamados ch WHERE ch.usuario_id = v_usuario), '[]'::jsonb)
    ),
    now() + make_interval(days => privado.dias_retencao('retencao_conteudo_dias'))
  FROM public.usuarios u WHERE u.id = v_usuario;

  DELETE FROM public.conversas WHERE v_usuario IN (comprador_id, vendedor_id);
  DELETE FROM public.chamados WHERE usuario_id = v_usuario;
  DELETE FROM public.produtos WHERE loja_id = v_loja;
  DELETE FROM public.lojas WHERE usuario_id = v_usuario;
  DELETE FROM public.usuarios WHERE id = v_usuario;
  DELETE FROM auth.users WHERE id = v_auth;
END;
$$;

-- Versão da 26 + chamados resolvidos há mais de retencao_chamados_dias
CREATE OR REPLACE FUNCTION privado.limpar_retencao()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, privado
AS $$
DECLARE
  v_conteudo INTERVAL := make_interval(days => privado.dias_retencao('retencao_conteudo_dias'));
  v_acesso INTERVAL := make_interval(days => privado.dias_retencao('retencao_registros_acesso_dias'));
  v_chamados INTERVAL := make_interval(days => COALESCE(privado.dias_retencao('retencao_chamados_dias'), 180));
BEGIN
  DELETE FROM public.conversas c
  WHERE c.ultima_mensagem_em < now() - v_conteudo
    AND NOT EXISTS (SELECT 1 FROM public.denuncias d WHERE d.conversa_id = c.id AND d.status = 'aberta');

  DELETE FROM public.chamados WHERE status = 'resolvido' AND resolvido_em < now() - v_chamados;

  DELETE FROM privado.conteudo_retido WHERE expira_em < now();

  DELETE FROM privado.denuncia_conversa dc
  USING public.denuncias d
  WHERE d.id = dc.denuncia_id AND d.status <> 'aberta' AND d.resolvida_em < now() - v_conteudo;
  UPDATE public.denuncias SET conteudo = NULL
  WHERE alvo_tipo = 'mensagem' AND status <> 'aberta' AND resolvida_em < now() - v_conteudo AND conteudo IS NOT NULL;

  DELETE FROM privado.registros_acesso WHERE criado_em < now() - v_acesso;
  DELETE FROM privado.acessos_admin_chat WHERE acessado_em < now() - v_acesso;
END;
$$;
REVOKE ALL ON FUNCTION privado.limpar_retencao() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Permissões das RPCs
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION
  public.abrir_chamado(text, text, text, uuid),
  public.enviar_mensagem_chamado(uuid, text, uuid),
  public.meus_chamados(),
  public.chamado_leitura(uuid),
  public.mensagens_do_chamado(uuid, bigint),
  public.marcar_chamado_lido(uuid),
  public.admin_listar_chamados(text),
  public.admin_ler_chamado(uuid),
  public.admin_responder_chamado(uuid, text, uuid),
  public.admin_status_chamado(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.abrir_chamado(text, text, text, uuid),
  public.enviar_mensagem_chamado(uuid, text, uuid),
  public.meus_chamados(),
  public.chamado_leitura(uuid),
  public.mensagens_do_chamado(uuid, bigint),
  public.marcar_chamado_lido(uuid),
  public.admin_listar_chamados(text),
  public.admin_ler_chamado(uuid),
  public.admin_responder_chamado(uuid, text, uuid),
  public.admin_status_chamado(uuid, text)
TO authenticated;

COMMIT;
