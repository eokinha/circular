-- Migração 34: fila de chamados do admin paginada (20 por página)
--
-- `admin_fila_chamados(p_status, p_pagina)` devolve {itens, total, pagina, por_pagina, contagens}.
-- Ordem: não resolvidos primeiro, depois com mensagem do aluno não lida, depois mais recentes.
-- `por_pagina` espelha POR_PAGINA_CHAMADOS em src/lib/suporte.ts (mudar os dois juntos).
-- A `admin_listar_chamados(text)` da 31 fica até o deploy do código novo; remover numa migração seguinte.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_fila_chamados(p_status text DEFAULT NULL, p_pagina integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por_pagina CONSTANT integer := 20;
  v_pagina integer := GREATEST(COALESCE(p_pagina, 1), 1);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('aberto', 'em_atendimento', 'resolvido') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'itens', COALESCE((
      WITH pagina AS (
        SELECT c.id,
               row_number() OVER (
                 ORDER BY c.status = 'resolvido',
                          EXISTS (SELECT 1 FROM public.chamado_mensagens m
                                  WHERE m.chamado_id = c.id AND NOT m.de_equipe AND m.lida_em IS NULL) DESC,
                          c.atualizado_em DESC, c.id
               ) AS ordem
        FROM public.chamados c
        WHERE p_status IS NULL OR c.status = p_status
      )
      SELECT jsonb_agg(public.chamado_json(ch, true) || jsonb_build_object('aluno', public.chamado_aluno_json(ch.usuario_id))
                       ORDER BY p.ordem)
      FROM pagina p
      JOIN public.chamados ch ON ch.id = p.id
      WHERE p.ordem > (v_pagina - 1) * v_por_pagina AND p.ordem <= v_pagina * v_por_pagina
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM public.chamados WHERE p_status IS NULL OR status = p_status),
    'pagina', v_pagina,
    'por_pagina', v_por_pagina,
    'contagens', (
      SELECT jsonb_build_object(
        'aberto', count(*) FILTER (WHERE status = 'aberto'),
        'em_atendimento', count(*) FILTER (WHERE status = 'em_atendimento'),
        'resolvido', count(*) FILTER (WHERE status = 'resolvido'),
        'todos', count(*)
      )
      FROM public.chamados
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_fila_chamados(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fila_chamados(text, integer) TO authenticated;

COMMIT;
