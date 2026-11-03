-- Migração 30: fecha na API três funções SECURITY DEFINER que ninguém precisa chamar por /rest/v1/rpc
-- (apontadas pelos advisors do Supabase).
--
-- - definir_nome_publico_loja() e sincronizar_nome_loja(): funções de trigger (lojas e usuarios). O Postgres só
--   confere EXECUTE de função de trigger ao criar o trigger, então os triggers continuam disparando.
-- - usuario_publico(): usada só na política usuarios_read_publico, que é TO authenticated. anon não lê usuarios.

BEGIN;

REVOKE ALL ON FUNCTION public.definir_nome_publico_loja() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_nome_loja() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.usuario_publico(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_publico(INT) TO authenticated;

COMMIT;
