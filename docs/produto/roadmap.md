# Roadmap — Circular

Atualizado em 2026-11-02 (fim do dia: PRs #16 e #17 na `main`). Base: `git log`, `docs/*.md` e `docs/produto/metricas.md` (0 anúncios reais).
Ordem dentro de cada faixa = prioridade. Tamanho: P (horas), M (1–2 dias), G (semana+).

## Agora — preparar e fazer o piloto na Unijorge e na Zarns

1. **Piloto com alunos reais da Unijorge e da Zarns** (G) — campi definidos e os outros fechados (migração 32).
   Entrega: plano de divulgação no campus (QR code da loja já existe), meta de N vendedores/anúncios
   e leitura semanal em `metricas.md`. **Bloqueio:** Lucas definir data, meta e quem divulga.
2. **Home fala do chat, não do WhatsApp** (P) — `src/pages/index.tsx:82` ainda diz "O contato é pelo WhatsApp";
   desde a migração 26 é o chat. Primeira frase que o visitante lê contradiz o produto.
3. **Ligar os e-mails do suporte** (P, só Lucas) — o canal está no ar desde o PR #16 (migrações 31 e 33), mas sem
   e-mail: criar a caixa `suporte@eokinha.com.br` (o Resend só envia) e pôr `RESEND_API_KEY` na Vercel (Production e Preview).
   Depois, abrir um chamado de teste e conferir os três e-mails (protocolo, resposta, resolução).
4. **Funil de entrada acessível e indexável** (P) — `_document.tsx` com `lang="pt-BR"`, `htmlFor` nos campos de login/cadastro/senha,
   `meta description`/`og:*` na home, `robots.txt` e `sitemap.xml` (itens 2, 3, 15 de `docs/relatorio-skills.md`;
   etapa 2 de `docs/relatorio-lighthouse.md`). Barato e afeta todo aluno que chega.
5. **Teste ponta a ponta do cadastro com e-mail real da Unijorge e da Zarns** (P) — cadastro → "Confira seu e-mail" → confirmar →
   onboarding → anunciar → conversa. Nunca foi feito logado em produção (`docs/pendencias-ajuda.md` §5, `docs/auditoria-mvp.md` §4).
   Aproveitar para preencher o guia de e-mail das duas faculdades (§2); a Zarns usa `@aluno.faculdadezarns.com.br` (Outlook).
6. **Conferir as telas de admin paginadas** (P, Lucas) — `/admin/suporte`, `/admin/contas` e `/admin/lojas` (PR #17) passaram
   em teste no banco e na build, mas não foram abertas no navegador logado como admin.
7. **Carga fria** — mantida por decisão do Lucas (108 anúncios na Unijorge, 72 na Zarns). Revisar antes de **2026-12-30**,
   quando todos vencem juntos.

## Pendências técnicas deixadas em 2026-11-02

- **Remover as RPCs antigas do admin** (P, migração 36) — `admin_listar_usuarios`, `admin_listar_lojas` e `admin_listar_chamados`
  ficaram só para o deploy anterior; o código já usa `admin_contas_pagina`, `admin_lojas_pagina` e `admin_fila_chamados`.
- **Paginação do que ainda carrega tudo** (P–M) — `/admin/imagens` (todos os perfis e todos os produtos via `getProdutosParaModeracao`),
  `/admin/denuncias` e `/admin/comentarios` (filas sem limite, com histórico) e `perguntas_do_anuncio` (carrega todas, mostra 3).
  Seguir o padrão de `src/lib/paginacao.ts` e da migração 35. Hoje o volume é pequeno.
- **Suporte: arestas conhecidas** (P) — aviso de resposta nova só no painel (não na Navbar); resposta gravada direto pela RPC,
  fora da tela, não gera e-mail; admin que abre chamado para si mesmo aparece como "Equipe". Protocolos seguem a partir de
  `CIR-2026-00032` (testes consumiram a sequência; já existe 1 chamado real).
- **Contagens das abas do admin** — vêm do servidor; mudanças feitas na tela só aparecem nelas ao recarregar.

## Próximo

- **Aceite dos Termos obrigatório no signup** (P, migração) — conta criada direto pela API nasce sem `termos_aceitos_em`
  (item 8 de `relatorio-skills.md`). Risco LGPD/jurídico.
- **Domínios suspeitos** — UCSal, SENAI CIMATEC e FGN estão fechadas desde a migração 32; revisar só quando forem reabertas.
- **Higiene do banco** (M) — índices nas 5 FKs do caminho quente; helpers de política fora da API (`campus_do_usuario(id)` expõe o campus
  de qualquer aluno); juntar políticas permissivas (itens 7, 10, 11 de `relatorio-skills.md`). Exige QA de RLS.
- **Velocidade** (M) — região das funções da Vercel para `gru1` (TTFB ~0,7 s → ~0,25 s; painel da Vercel, autorização do Lucas);
  fotos do hero menores; ajustes do Cloudflare (Web Analytics, ofuscação de e-mail). Ver `plano-otimizacao-next.md`.
- **Blocos do AdSense** (P) — fica no MVP (decisão do Lucas). Hoje o script carrega ~200 KB em todas as páginas sem
  nenhum bloco: definir onde entram os anúncios e carregar o script só nessas páginas.
- **Revisão jurídica de Termos e Privacidade** (M, externo) — rascunho funcional desde 2026-10-14. Antes de divulgação ampla. Custo: Lucas.

## Depois

- **Push do chat (OneSignal)** (G) — sem push, vendedor não sabe que tem mensagem. Só vale com conversas reais acontecendo;
  `mensagens.notificado_em` já reservado. Serviço novo: autorização do Lucas.
- **Painel de métricas no admin** (M) — hoje a leitura é manual por SQL; fazer quando houver volume.
- **Abrir o segundo campus** (G) — depois que o piloto mostrar conversas com resposta. Exige catálogo inicial e guia do e-mail da faculdade.
- **Proteção de senha vazada no Supabase Auth** — exige plano Pro (custo); o app já checa no navegador.
- Fora do escopo desta versão: pagamento interno, notificações por e-mail.
