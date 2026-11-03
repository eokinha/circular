# Auditoria de regras de negócio — preparação do MVP

Data: 2026-10-14 · Escopo: regras de negócio, RLS/triggers do Supabase e fluxos do app.

Este documento registra os furos encontrados, o plano de correção e o que foi mudado.
A parte de banco está em `db/migrations/16_regras_mvp.sql`.

---

## 1. Furos encontrados

### Críticos (bloqueavam o lançamento)

| # | Furo | Causa |
|---|------|-------|
| 1 | Aluno conseguia trocar o endereço do próprio perfil para qualquer slug livre (ex.: `circular-oficial`) | `lojas.slug` editável pelo dono, sem validação de formato (a unicidade já existia via índice `idx_lojas_slug_unique`) |
| 2 | Loja reprovada conseguia voltar sozinha | Política `ALL` deixava o dono apagar e recriar a loja com `status = 'ativo'` |
| 3 | Campus do aluno não era garantido | RPC de verificação aceitava qualquer `instituicoes_id`; após verificado, o aluno mudava instituição e matrícula livremente; regra `aluno.%` aceitava qualquer domínio |
| 4 | Storage sem limite de tamanho/tipo | Buckets públicos aceitavam qualquer arquivo; limite só no cliente |

### Importantes

| # | Furo |
|---|------|
| 5 | Anúncio de venda com preço 0 (sem `CHECK` no banco; formulário aceitava 0) |
| 6 | Anúncio publicado sem WhatsApp na loja → botão "Tenho interesse" quebrado |
| 7 | Revogar a verificação não tirava os anúncios do ar |
| 8 | Contato sem login: WhatsApp exposto a visitantes, telefone de todos legível pela API |
| 9 | Qualquer visitante listava todos os usuários (nome, instituição, `is_admin`) |
| 10 | Listagem dependia só do RLS (admin/dono viam pausados no catálogo) e não tinha paginação |
| 11 | Sem banimento: `usuarios.status` editável pelo próprio usuário |
| 12 | Falha no upload criava anúncio sem foto (retentativa duplicava); imagens órfãs ao excluir |

### Lacunas de produto

- Sem edição de anúncio
- Sem status "vendido" e sem expiração de anúncio
- Sem denúncia de anúncio/perfil
- Sem Termos de Uso, Política de Privacidade e exclusão de conta (LGPD)
- Sem métrica de interesse (cliques em "Tenho interesse")
- Listagem não abria no campus do aluno

### Pendências de produção (P3)

- Funções auxiliares SECURITY DEFINER executáveis por `anon`
- Proteção de senha vazada desligada, confirmação de e-mail, URLs de redirect, projeto de produção separado

---

## 2. Decisões tomadas

- **Contato exige login** (regra já descrita no `CLAUDE.md`). O telefone sai da leitura pública de
  `lojas` e passa a vir da RPC `contato_vendedor`, que também registra o interesse (métrica).
- **Instituição vem do domínio do e-mail.** Nova coluna `instituicoes.dominios text[]`. A verificação
  automática só acontece se o domínio do e-mail confirmado bater com uma instituição cadastrada; a
  instituição é definida pelo banco, não pelo cliente. Sem correspondência → verificação manual.
  `validarEmailUniversitario` (cliente) vira só uma dica de UX no cadastro.
- **Expiração: 60 dias** sem renovação. O anúncio some do catálogo e o dono renova com um clique.
  (30 dias deixaria o catálogo vazio cedo demais no início do MVP.)
- **Vendido** é um status novo (`ativo | pausado | vendido`), com `vendido_em` para métrica.
- **Bloqueio de usuário** pelo admin: reprova a loja e pausa os anúncios. Desbloquear deixa a loja
  `pausado` para o próprio aluno reativar.
- **Denúncias** guardam um resumo do alvo, então continuam legíveis mesmo se o denunciado excluir a conta.
- **Exclusão de conta** apaga produtos, loja, usuário e login (Auth). As imagens são removidas pelo
  cliente antes (o Supabase bloqueia apagar `storage.objects` via SQL).

---

## 3. Plano e status

### Banco — migração 16

| Item | Mudança | Status |
|------|---------|--------|
| 1 | Formato + `NOT NULL` em `lojas.slug`; trigger impede o dono de mudar `slug`, `usuario_id` e `criado_em` | feito |
| 2 | Dono só tem `SELECT`/`UPDATE` na loja (sem `INSERT`/`DELETE`); `minha_loja()` para o painel | feito |
| 3 | `instituicoes.dominios`, `instituicao_por_email()`, nova `verificar_matricula_por_email(p_matricula)`; trigger trava `instituicoes_id`/`matricula` de quem está verificado; remove `email_academico()` | feito |
| 4 | Buckets `lojas`/`produtos`: 3 MB e só JPG/PNG/WebP | feito |
| 5 | `CHECK (preco >= 0 AND (preco > 0 OR aceita_troca))` | feito |
| 6 | Publicar exige WhatsApp na loja; dono não apaga o WhatsApp com anúncios ativos | feito |
| 7 | Perder a verificação (admin ou próprio aluno) pausa os anúncios ativos | feito |
| 8 | `contato`/`whatsapp` fora da leitura pública; RPC `contato_vendedor` (exige login) + tabela `interesses` | feito |
| 9 | Usuário só é público se tiver anúncio ativo; `anon` não lê `is_admin`, `auth_id`, `status` | feito |
| 11 | `usuarios.status` (`ativo | bloqueado`) protegido; RPC `admin_definir_status_usuario`; bloqueado não publica | feito |
| — | Status `vendido`, `renovado_em`, `vendido_em`; catálogo esconde anúncio sem renovação há 60 dias | feito |
| — | Tabela `denuncias` + RPCs `denunciar`, `admin_listar_denuncias`, `admin_resolver_denuncia` | feito |
| — | `usuarios.termos_aceitos_em` gravado no signup; RPC `excluir_minha_conta` | feito |
| — | `admin_listar_lojas` com interesses e vendidos; `admin_listar_usuarios` com status | feito |
| P3 | Políticas que usam `is_admin()`/`meu_usuario_id()` restritas a `authenticated`; `EXECUTE` revogado de `anon` | feito |

### Aplicação

| Item | Mudança | Status |
|------|---------|--------|
| 8 | `BotaoContato` (RPC + redireciona para login) no modal e no perfil; `ProdutoListagem` sem telefone | feito |
| — | `BotaoDenunciar` no modal e no perfil; página `/admin/denuncias` | feito |
| 10 | Listagem filtra `status = 'ativo'`, loja ativa e não expirado; paginação; abre no campus do aluno logado | feito |
| 5, 6, 12 | Anunciar: preço > 0 na venda, exige WhatsApp, valida a foto antes, desfaz o anúncio se o upload falhar | feito |
| — | Editar anúncio (`/anunciar?editar=<id>`) | feito |
| — | Painel: marcar como vendido, renovar anúncio expirado, editar; filtro "Vendidos" | feito |
| 12 | Excluir anúncio remove a imagem do Storage | feito |
| 11 | Admin: bloquear/desbloquear aluno; colunas de interesses e vendidos nas lojas | feito |
| — | Páginas `/termos` e `/privacidade`, links no rodapé, aceite obrigatório no cadastro | feito |
| — | Excluir conta no painel (Perfil) | feito |
| — | Login respeita `?next=` para voltar à página de origem | feito |

### Manual (painel do Supabase — não dá para fazer por migração)

- [ ] **Authentication → Providers → Email:** manter "Confirm email" **ligado**. Sem isso a verificação
      acadêmica não vale (bastaria cadastrar um e-mail `.edu.br` alheio).
- [ ] **Authentication → Policies/Passwords:** ligar "Leaked password protection" (exige plano Pro do Supabase).
- [x] **Authentication → URL Configuration:** Site URL e redirects apontando para o domínio de produção.
- [ ] **Projeto de produção separado:** `setup_completo.sql` + migrações `00 … 17` na ordem do `CLAUDE.md`.
      Não rodar `db/seed/carga_fria.sql` em produção. *(Substituído em 2026-10-31: o banco do MCP é o de produção e a carga
      fria foi aplicada nele de propósito; ver `docs/produto/decisoes.md`.)*
- [x] **Instituições:** cadastrar cada instituição atendida com seus domínios
      (`UPDATE instituicoes SET dominios = '{ufmg.br}' WHERE id = 1;`). Domínios de subdomínio
      (`aluno.ufmg.br`) já são cobertos pelo domínio raiz.
- [ ] **Revisão jurídica** dos textos de `/termos` e `/privacidade` (são um rascunho funcional).
- [x] **Dev:** a migração adicionou `lojas_slug_key` (UNIQUE) antes de descobrir que o índice
      `idx_lojas_slug_unique` já existia. O arquivo da migração já não cria a constraint; no banco de dev
      ela foi removida em 2026-10-14.
- [x] **Unijorge e instituições de Salvador:** cadastradas com seus domínios na migração `17` (CNPJ virou opcional).
      Conferir o nome da instituição de `fgn.edu.br`, cadastrada provisoriamente como "FGN".

---

## 4. Como foi verificado

- **Banco (dev), simulando `authenticated`/`anon` com JWT, em transações desfeitas:**
  dono não muda slug, não apaga nem cria loja, não lê telefone; aluno verificado não troca instituição,
  matrícula nem status; preço 0 em venda é recusado; `contato_vendedor` devolve o telefone e grava
  `interesses`; denúncia grava resumo do alvo; perder a verificação pausa os anúncios e impede publicar;
  publicar sem WhatsApp é recusado; apagar o WhatsApp com anúncio ativo é recusado; `vendido_em` e
  `renovado_em` são gravados pelo banco; `destaque` não é alterado pelo vendedor; visitante não lê
  telefone nem `is_admin`, não executa `is_admin()`/`contato_vendedor()` e só vê usuários com anúncio
  ativo; bloqueio pelo admin reprova a loja e pausa os anúncios; domínio `aluno.ufmg.br` → UFMG,
  `fakeufmg.br` → nenhuma.
- **API pública (chave anon):** `select contato` em `lojas` → 42501; `denuncias`/`interesses` → 42501;
  upload de `text/html` no bucket → 415.
- **App:** `tsc`, `eslint`, `npm test` (19 testes, incluindo `anuncios.test.ts`) e `next build` passam;
  servidor de produção local respondeu 200 em `/`, `/listagem` (com e sem filtro, página 2), `/perfil/1`,
  `/perfil/lucas-silva`, `/termos`, `/privacidade`, `/cadastro`; rotas protegidas redirecionam para o login;
  nenhum telefone aparece no HTML público.
- **Não testado ponta a ponta logado** (a senha dos testers não está no repositório): fluxo de contato,
  denúncia, edição, vendido/renovar e exclusão de conta pela interface. As regras de banco por trás
  deles foram testadas acima.

---

## 5. O que mudou para quem desenvolve

- Telefone da loja **não** é mais lido por `select` em `lojas` (nem pelo dono). Dono usa `getMinhaLoja`
  (RPC `minha_loja`); comprador usa `getContatoVendedor` (RPC `contato_vendedor`).
- `getOrCreatePerfilEstudante` virou `getMinhaLoja`: a loja é criada só pelo trigger de signup.
- `verificarMatriculaInstantanea(matricula?)` não recebe mais instituição.
- Toda query de catálogo filtra `status = 'ativo'`, loja `ativo` e `renovado_em` dentro do prazo
  (`DIAS_VALIDADE_ANUNCIO` em `queries.ts`, espelho do RLS).
- Removidas funções sem uso que liam o telefone: `getLojas`, `getLojaByAuthId`, `getProdutosByLoja`,
  `getProdutosAgrupadosPorCategoria`.
- `negocio.mdc` é legado (regras antigas do Mercadinho); vale o `CLAUDE.md`.
