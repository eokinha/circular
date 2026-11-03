-- Migração 33: retenção também para chamado de suporte abandonado (achado do QA da 31)
--
-- A 31 só apagava chamado `resolvido`; chamado aberto ou em atendimento sem atividade ficava para sempre
-- com texto livre do aluno. Agora qualquer chamado sem atividade (`atualizado_em`, que muda a cada mensagem
-- e mudança de status) há mais de `retencao_chamados_dias` (180) é apagado. O resto da função é igual à 31.

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

  DELETE FROM public.chamados WHERE atualizado_em < now() - v_chamados;

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
