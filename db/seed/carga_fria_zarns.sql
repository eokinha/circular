-- Carga fria da Faculdade Zarns (2026-11-02)
--
-- Rodar depois de db/seed/carga_fria.sql e da migração 32. Move 2 dos 5 vendedores de teste (lojas 2 e 3,
-- contas @example.com) da Unijorge para a Zarns, com os anúncios deles (as 9 categorias principais em cada um).
-- A Unijorge fica com as lojas 1, 4 e 5. Para desfazer, trocar o domínio abaixo pelo da Unijorge.
-- Não reenvia fotos: as URLs do Storage são da pasta do produto e continuam válidas.

UPDATE public.usuarios u
SET instituicoes_id = public.instituicao_por_email('carga@aluno.faculdadezarns.com.br')
FROM public.lojas l
WHERE l.usuario_id = u.id
  AND l.id IN (2, 3)
  AND u.email LIKE '%@example.com'
  AND public.instituicao_por_email('carga@aluno.faculdadezarns.com.br') IS NOT NULL;
