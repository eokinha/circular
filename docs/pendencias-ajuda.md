# Pendências — Ajuda e e-mail da faculdade

Levantadas em 31/10/2026, na entrega do `/ajuda` e do tutorial do e-mail (PR #1).
Ao resolver um item, apague-o daqui e registre a mudança no lugar indicado.

## 1. Domínios suspeitos em `instituicoes.dominios`

Consulta de MX feita em 31/10/2026. Confirmar com alunos qual endereço eles realmente recebem
e corrigir numa migração nova (`db/migrations/20_...`) e em `GUIAS_POR_DOMINIO` (`src/lib/guias-email.ts`).

| Faculdade | Cadastrado | Problema |
|---|---|---|
| UCSal | `ucsal.br` | `ucsal.edu.br` também existe (Google) e **não é aceito**: não é subdomínio de `ucsal.br`. Se os alunos usam `.edu.br`, o cadastro é recusado |
| SENAI CIMATEC | `senaicimatec.com.br` | `ba.estudante.senai.br` (Google) existe e pode ser o domínio dos alunos; não está cadastrado |
| FGN | `fgn.edu.br` | O domínio **não tem MX** (não recebe e-mail): provavelmente está errado |

## 2. Detalhes por faculdade no tutorial

Hoje cada domínio de `GUIAS_POR_DOMINIO` só tem o provedor (Outlook ou Gmail, tirado do MX) e a tela
usa o texto genérico. Preencher, quando confirmado com alunos da faculdade:

- `formatoEndereco` — ex.: `matricula@alunos.estacio.br`
- `primeiroAcesso` — como conseguir a senha na primeira vez
- `suporte` — onde pedir ajuda na faculdade

Primeira a preencher: **Unijorge** (já há contato com alunos). UFMG e PUC Minas não têm guia
(UFMG usa servidor próprio); avaliar se continuam participantes.

## 3. Prints no passo a passo

O tutorial (`src/components/GuiaEmail.tsx`) usa texto + ícones. Trocar/complementar com prints do
Outlook e do Gmail (e por faculdade, se o portal do aluno tiver atalho próprio).

## 4. Canal de suporte do Circular

Não existe e-mail nem WhatsApp de suporte publicado. O login diz "Entre em contato com o suporte"
(conta bloqueada) sem dizer como, e o FAQ manda o aluno para a TI da faculdade. Definir o canal e
incluí-lo em `src/lib/faq.ts`, no login e no rodapé.

## 5. Teste ponta a ponta em produção

Não testado na entrega: cadastro com e-mail institucional real → tela "Confira seu e-mail" →
reenviar link → confirmar → onboarding; e o reenvio de confirmação pelo login.
Está no "Agora" de `docs/produto/roadmap.md`.
