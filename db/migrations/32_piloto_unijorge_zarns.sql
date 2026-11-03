-- 32 — Piloto só na Unijorge e na Zarns (decisão do Lucas em 2026-11-02)
--
-- Cadastra a Faculdade Zarns (alunos usam @aluno.faculdadezarns.com.br) e fecha o cadastro das outras
-- instituições esvaziando `dominios`: a linha continua (contas antigas mantêm o campus), mas nenhum
-- e-mail novo casa com elas em `instituicao_por_email()`/`email_cadastro_permitido()`.
--
-- Para reabrir uma faculdade, devolver o domínio. Domínios que existiam antes desta migração:
--   1 UFMG ............ {ufmg.br}
--   2 PUC Minas ....... {pucminas.br}
--   3 UNIFACS ......... {unifacs.br}
--   4 Bahiana ......... {bahiana.edu.br}
--   6 UniRuy .......... {uniruy.edu.br}
--   7 FGN ............. {fgn.edu.br}
--   8 UniFTC .......... {uniftc.edu.br}
--   9 SENAI CIMATEC ... {senaicimatec.com.br}
--  10 UCSal ........... {ucsal.br}
--  11 UNINASSAU ....... {uninassau.edu.br}
--  12 Estácio ......... {estacio.br}

UPDATE public.instituicoes
SET dominios = '{}'
WHERE id IN (1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12);

INSERT INTO public.instituicoes (nome, dominios)
SELECT 'Faculdade Zarns', ARRAY['aluno.faculdadezarns.com.br']
WHERE NOT EXISTS (
  SELECT 1 FROM public.instituicoes WHERE 'aluno.faculdadezarns.com.br' = ANY (dominios)
);
