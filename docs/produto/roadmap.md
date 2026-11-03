# Roadmap — Circular

Atualizado em 2026-11-02. Base: `git log`, `docs/*.md` e `docs/produto/metricas.md` (0 anúncios reais).
Ordem dentro de cada faixa = prioridade. Tamanho: P (horas), M (1–2 dias), G (semana+).

## Agora — preparar e fazer o piloto na Unijorge e na Zarns

1. **Piloto com alunos reais da Unijorge e da Zarns** (G) — campi definidos e os outros fechados (migração 32).
   Entrega: plano de divulgação no campus (QR code da loja já existe), meta de N vendedores/anúncios
   e leitura semanal em `metricas.md`. **Bloqueio:** Lucas definir data, meta e quem divulga.
2. **Home fala do chat, não do WhatsApp** (P) — `src/pages/index.tsx:82` ainda diz "O contato é pelo WhatsApp";
   desde a migração 26 é o chat. Primeira frase que o visitante lê contradiz o produto.
3. **Canal de suporte do Circular** (M, em andamento) — chamado no site, atendimento em chat pelo admin, e-mail
   `suporte@eokinha.com.br` formalizando (migração 31). Depois: Lucas configurar `RESEND_API_KEY` e a caixa de suporte.
4. **Funil de entrada acessível e indexável** (P) — `_document.tsx` com `lang="pt-BR"`, `htmlFor` nos campos de login/cadastro/senha,
   `meta description`/`og:*` na home, `robots.txt` e `sitemap.xml` (itens 2, 3, 15 de `docs/relatorio-skills.md`;
   etapa 2 de `docs/relatorio-lighthouse.md`). Barato e afeta todo aluno que chega.
5. **Teste ponta a ponta do cadastro com e-mail real da Unijorge** (P) — cadastro → "Confira seu e-mail" → confirmar →
   onboarding → anunciar → conversa. Nunca foi feito logado em produção (`docs/pendencias-ajuda.md` §5, `docs/auditoria-mvp.md` §4).
   Aproveitar para preencher o guia de e-mail da Unijorge (§2).
6. **Carga fria** — mantida por decisão do Lucas. Revisar antes de **2026-12-30**, quando os 180 anúncios vencem juntos.

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
