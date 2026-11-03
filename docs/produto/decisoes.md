# Registro de decisões — Circular

Mais recente no topo. Decisões `aceita` anteriores a 2026-11-02 foram reconstruídas do `git log` e do `CLAUDE.md`
(já estão no código; o registro é para saber quando e por quê).

---

## 2026-11-02 — Piloto só na Unijorge e na Zarns; as outras faculdades fechadas
- **Status:** aceita (Lucas; migração 32)
- **Decisão:** o próximo ciclo é trazer os primeiros alunos reais da Unijorge e da Faculdade Zarns (`@aluno.faculdadezarns.com.br`,
  Outlook). As outras 11 instituições ficam com `dominios` vazio: ninguém novo cadastra, a linha continua e dá para reabrir
  (os domínios antigos estão no cabeçalho da migração 32). A única conta da UFMG era de teste e foi excluída.
- **Contexto:** em 2026-11-02 o banco tem 0 anúncios reais; os 180 ativos são da carga fria. Marketplace precisa de densidade por campus.
- **Alternativas:** abrir as 12 instituições de uma vez (catálogo vazio em 11 delas); continuar construindo sem usuário.
- **Consequências:** a Zarns começa sem catálogo inicial; métricas lidas só desses dois campi. Pendente: data, meta e quem divulga.

## 2026-11-02 — Carga fria mantida por enquanto
- **Status:** aceita (Lucas)
- **Decisão:** os 180 anúncios das lojas 1 a 5 continuam como estão; sem gatilho de retirada por ora.
- **Contexto:** todos vencem juntos em **2026-12-30**: decidir antes disso se renova ou retira.
- **Consequências:** precisa de alguém respondendo as conversas das lojas 1 a 5 enquanto existirem.

## 2026-11-02 — Suporte por e-mail com atendimento em chat interno
- **Status:** aceita (Lucas; em implementação, migração 31)
- **Decisão:** o aluno abre chamado no site, a equipe atende pela conta admin em chat com o aluno, e o e-mail
  (`suporte@eokinha.com.br`) formaliza o atendimento (protocolo, respostas e encerramento). Quem não consegue entrar usa o e-mail direto.

## 2026-11-02 — AdSense continua no MVP
- **Status:** aceita (Lucas)
- **Decisão:** manter a monetização por anúncios. Pendente: onde colocar os blocos (hoje o script carrega sem nenhum bloco).

## 2026-11-02 — Cache só no Next, sem regra de cache no Cloudflare
- **Status:** aceita (commits `66b3391` e `54ab410`)
- **Decisão:** páginas públicas sem sessão saem com `private, no-cache` (`liberarCacheVisitante`); o Cloudflare não guarda HTML.
- **Alternativas:** cache de borda com `Cloudflare-CDN-Cache-Control` e limpeza no deploy (plano no `66b3391`).
- **Consequências:** TTFB continua dependendo da função da Vercel (região `iad1`, ver roadmap).

## 2026-11-01 — Moderação de contas no lugar da aprovação de matrícula
- **Status:** aceita (migração 27)
- **Decisão:** matrícula é verificada só pelo e-mail confirmado; a equipe suspende, bloqueia e reativa contas em `/admin/contas`, com motivo.
- **Consequências:** nenhum aluno espera aprovação manual; o controle passa a ser reativo (denúncias).

## 2026-11-01 — Chat próprio como canal principal; WhatsApp opcional
- **Status:** aceita (migração 26)
- **Decisão:** "Tenho interesse" abre o chat do Circular; WhatsApp só se o vendedor cadastrar. Chat sem moderação automática,
  retenção de 30 dias, registros de acesso por 180 dias (Marco Civil).
- **Contexto:** exigir telefone para anunciar era barreira e expunha dado pessoal.
- **Consequências:** sem push, o aluno só vê mensagem nova se abrir o site (push via OneSignal planejado).

## 2026-11-01 — Perguntas e avaliações com moderação externa (Vettly) antes de gravar
- **Status:** aceita (migrações 24 e 25)
- **Decisão:** texto vai à Vettly antes de gravar; `block` não grava, `flag`/falha vai para a fila do admin. Avaliação só para quem registrou interesse.
- **Consequências:** custo e dependência de serviço externo; sem chave, tudo fica em análise.

## 2026-11-01 — Monetização inicial por anúncios (Google AdSense) e medição por GA4
- **Status:** aceita (commits `7f46f75`, `b96f787`, `c96ba86`, `0b1e649`)
- **Decisão:** GA4 em todas as páginas; script do AdSense no `_app`, só no domínio de produção.
- **Contexto:** não há bloco de anúncio no código ainda; o script carrega ~200 KB em todas as páginas sem gerar receita
  (`docs/relatorio-lighthouse.md`). Revisão proposta no roadmap.

## 2026-11-01 — Nome de exibição opcional e nome de usuário escolhido
- **Status:** aceita (migrações 23 e 29)
- **Decisão:** o aluno pode aparecer com uma marca (ex.: "Bia Doces") em vez do nome; o link do perfil usa um nome de usuário próprio.

## 2026-11-01 — Mote "Economia no Campus"
- **Status:** aceita (commit `132713f`)

## 2026-10-31 — Cada aluno fica no campus do próprio e-mail
- **Status:** aceita (migração 19)
- **Decisão:** o domínio do e-mail define o campus; sem seletor nem filtro. Trocar de campus = trocar o e-mail.
- **Consequências:** perfil e anúncio de outro campus só abrem em modo leitura (links compartilhados).

## 2026-10-31 — Catálogo inicial (carga fria) na Unijorge, no banco de produção
- **Status:** aceita (commit `220934f`)
- **Decisão:** 5 vendedores de teste e 180 anúncios na Unijorge, com fotos CC0.
- **Consequências:** substitui o item "não rodar a carga fria em produção" de `docs/auditoria-mvp.md`. As métricas precisam excluir as lojas 1 a 5.

## 2026-10-14 — Regras do MVP (validade de 60 dias, vendido, denúncias, LGPD)
- **Status:** aceita (migração 16; detalhes em `docs/auditoria-mvp.md`)
- **Decisão:** anúncio vence em 60 dias sem renovação (30 esvaziaria o catálogo cedo); status `vendido`; contato exige login;
  denúncia de anúncio/perfil; Termos, Privacidade e exclusão de conta.

## 2026-10-09 — Rebranding para Circular
- **Status:** aceita (commit `71a61b4`)
- **Decisão:** Mercadinho Universitário passa a se chamar Circular (design system 2.0, slogan "Deixa Circular.").
