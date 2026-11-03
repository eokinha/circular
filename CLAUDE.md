# Circular

**Circular** — marketplace universitário onde alunos compram e trocam itens com colegas do próprio campus.
(Nome anterior: Mercadinho Universitário.)

## Stack

- Next.js com **Page Router** (sem App Router)
- TypeScript
- Tailwind CSS
- Supabase (`@supabase/supabase-js`)

### Deploy (Vercel)

No painel do projeto: **Settings → Environment Variables** defina, para cada ambiente
em que a build roda (Production, Preview, Development):

- `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto (ex.: `https://xxxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — ou, na ausência, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VETTLY_API_KEY` e `VETTLY_POLICY_ID` — moderação de perguntas e avaliações (só servidor; sem elas tudo fica em análise)
- `MODERACAO_SEGREDO` — segredo que as rotas `/api` mandam para `aplicar_moderacao`; o banco guarda só o SHA-256
  em `privado.config` (chave `moderacao_segredo_sha256`). Trocar o segredo = gravar o novo hash lá e a variável na Vercel

E-mails do Supabase Auth (recuperação de senha, confirmação) saem pelo SMTP do Resend,
configurado no painel do Supabase (Authentication → SMTP), não pelo código.
Remetente `nao-responda@eokinha.com.br`; templates versionados em `db/emails/` (colar no painel ao alterar).

### Cache

- Páginas públicas sem dado de aluno chamam `liberarCacheVisitante(ctx)` (`src/lib/cache.ts`) no `getServerSideProps`,
  depois das consultas: hoje `/` (só visitante), `/login`, `/cadastro` e `/ajuda`. Sem cookie de sessão do Supabase, saem com
  `Cache-Control: private, no-cache` no lugar do `no-store` do Next (libera o bfcache; nenhum CDN guarda a página)
- Nunca chamar o helper em página com dado de aluno (painel, anunciar, mensagens, admin, catálogo, perfil, anúncio, onboarding,
  confirmar-email, redefinir-senha, `/api`)
- Arquivos de `public/` (`/hero`, `/brand`, `/faculdades`, ícones) têm 1 dia de cache em `next.config.ts` e o middleware
  não roda neles (filtro por extensão no `matcher`); fotos do Storage sobem com cache de 1 ano (a URL muda a cada upload)
- O Cloudflare na frente da Vercel não tem regra de cache para HTML. Um plano para cachear as páginas públicas lá
  (cabeçalho `Cloudflare-CDN-Cache-Control` + limpeza no deploy) está no commit `66b3391`

O cliente em `src/lib/supabase.ts` só valida e cria o cliente no **primeiro uso**;
assim a build não quebra na importação do módulo, mas a aplicação exige as variáveis
acima em runtime e, se a build executar `getServerSideProps` com essas chaves, também
no ambiente de build. Sem isso, páginas que consultam o Supabase falham ao acessar.

---

## Estrutura de pastas

```
src/
├── middleware.ts         # Sessão Supabase + proteção de /minha-loja e /admin (admin exige is_admin)
├── pages/
│   ├── _app.tsx          # Layout global (Navbar + Footer)
│   ├── index.tsx         # Home (hero + impulsionados)
│   ├── listagem.tsx      # Listagem completa de produtos com filtros
│   ├── login.tsx, cadastro.tsx, esqueci-senha.tsx, redefinir-senha.tsx, confirmar-email.tsx, onboarding.tsx
│   ├── anunciar.tsx      # Criação de anúncio; ?editar=<id> edita um anúncio próprio
│   ├── termos.tsx, privacidade.tsx  # Termos de Uso (itens proibidos) e Política de Privacidade
│   ├── ajuda.tsx         # FAQ público (conteúdo em lib/faq.ts; âncora por pergunta, ex.: /ajuda#nao-chegou)
│   ├── lojas/[slug].tsx  # Perfil público da loja
│   ├── perfil/[id].tsx   # Perfil público do estudante
│   ├── anuncio/[id].tsx  # Página do anúncio (/anuncio/{id}-{nome}; nome errado redireciona para o certo) + perguntas
│   ├── mensagens/        # Chat: index (caixa de entrada) e [id] (conversa em tempo real); exige login
│   ├── api/              # perguntas, respostas, avaliacoes: gravam pela RPC e moderam na Vettly (src/lib/moderacao.ts)
│   ├── painel/           # Painel do estudante (index, anuncios, favoritos, perfil)
│   ├── minha-loja/       # Rotas antigas: só redirecionam para /painel e /anunciar
│   └── admin/
│       ├── contas.tsx        # Moderação de contas: suspender, bloquear, reativar e histórico (somente admin;
│       │                     # /admin/verificacoes redireciona para cá)
│       ├── lojas.tsx         # Status das lojas e produtos impulsionados (somente admin)
│       ├── imagens.tsx       # Upload de avatar/capa/imagens (somente admin)
│       ├── denuncias.tsx     # Fila de denúncias: abas Anúncios e perfis / Comentários (somente admin)
│       └── comentarios.tsx   # Perguntas/avaliações que a Vettly não aprovou (somente admin)
├── components/           # Navbar, Footer, HeroSection, CardProduto (link para a página do anúncio),
│                         # BotaoContato (WhatsApp via RPC), BotaoDenunciar,
│                         # ConfiraEmail (pós-cadastro/senha), GuiaEmail + AjudaEmailFaculdade (tutorial do e-mail),
│                         # BotaoCompartilhar (QR code e link de loja ou anúncio, para qualquer aluno logado)
│   ├── painel/           # PainelEstudante (cabeçalho/visão geral) + SecaoAnuncios, SecaoFavoritos, SecaoPerfil
│   └── chat/             # CaixaEntrada (lista + conversa), ListaConversas, ConversaChat; BotaoConversar abre a conversa
├── lib/
│   ├── supabase.ts       # Clientes Supabase (browser e servidor via @supabase/ssr)
│   ├── queries.ts        # Funções de fetch e RPCs
│   ├── painel-data.ts    # getServerSideProps compartilhado do painel
│   ├── painel-routes.ts  # Rotas/abas do painel
│   ├── storage.ts        # Helpers de upload para Supabase Storage
│   ├── cache.ts          # Cache-Control das páginas públicas (só para visitante sem cookie de sessão)
│   ├── contato.ts        # Link/formatação do WhatsApp
│   ├── avisos-login.ts   # Avisos fixos do /login (?aviso=) e urlLogin
│   ├── senha-vazada.ts   # Checagem de senha vazada (HIBP, k-anonimato) no cadastro e redefinição
│   ├── anuncios.ts       # Validade (60 dias), modalidade e descrição de troca do anúncio
│   ├── compartilhar.ts   # Link do QR code da loja (?c=código&utm_source=qr) e leitura do next do login
│   ├── guias-email.ts    # Provedor (Outlook/Gmail) e passo a passo do e-mail por domínio de faculdade
│   ├── faq.ts            # Perguntas e respostas do /ajuda (revisar ao mudar regra de negócio)
│   ├── faculdades.ts     # Logo da faculdade na Navbar (por domínio; arquivos em public/faculdades/) e nome curto
│   ├── titulos.ts        # Título da aba por rota (padrão no _app; página com título dinâmico sobrescreve)
│   ├── moderacao.ts      # Chamada à Vettly e gravação do resultado (só servidor) · api-rotas.ts: POST JSON e erros
│   ├── chat.ts           # Regras puras do chat (tópicos dos canais, junção de mensagens, datas) · chat-realtime.ts: canais do Realtime
│   └── validacoes.ts     # CPF, telefone, e-mail acadêmico
└── types/
    └── index.ts          # Interfaces TypeScript
db/
├── setup_completo.sql    # Setup histórico (rodar antes das migrações; não editar)
└── migrations/           # Migrações numeradas
docs/produto/             # Decisões, roadmap, specs e métricas (mantido pelo product-manager)
.claude/agents/           # Subagentes product-manager, tech-lead e qa-engineer (ver "Agentes e orquestração")
```

---

## Banco de dados (Supabase)

```
instituicoes   — id, nome, cnpj (opcional), dominios (text[] — domínios de e-mail da instituição, ex.: {ufmg.br})
usuarios       — id, auth_id (uuid → auth.users), nome, sobrenome, email, password (legado, não usar), telefone, cpf, matricula,
                 matricula_validada (bool), matricula_status (pendente|verificado|rejeitado), instituicoes_id,
                 status (ativo|bloqueado), is_admin (bool), criado_em, termos_aceitos_em
lojas          — id, usuario_id (UNIQUE), nome (nome público, calculado), nome_exibicao (marca opcional), descricao, contato, status (pendente|ativo|pausado|reprovado), criado_em, avatar_url, capa_url,
                 slug, instagram_url, tiktok_url, whatsapp, locais_entrega (text[]),
                 horarios (jsonb: [{dia 0-6, inicio, fim "HH:MM"}], regra horarios_validos)
produtos       — id, loja_id, nome, descricao, preco (numeric), imagem_url, status (ativo|pausado|vendido), criado_em, categoria_id,
                 destaque (bool — impulsionado na home, só admin), aceita_troca (bool), renovado_em, vendido_em
categorias     — id, nome, parent_id (2 níveis), icone
favoritos      — id (uuid), usuario_id, produto_id, criado_em
interesses     — id, loja_id, produto_id, usuario_id, criado_em (clique em "Tenho interesse"; só via RPC)
denuncias      — id, denunciante_id, loja_id, produto_id, alvo_tipo (anuncio|perfil|pergunta|resposta|avaliacao), pergunta_id,
                 avaliacao_id, conteudo (cópia do comentário), alvo_descricao, motivo, detalhes, status (aberta|resolvida|descartada),
                 criado_em (só via RPC)
perguntas      — id, produto_id, autor_id, texto, status (pendente|aprovado|recusado), moderacao_id, resposta, resposta_status,
                 respondida_em, criado_em (só via RPC)
avaliacoes     — id, loja_id, autor_id, nota (1–5), comentario, status, moderacao_id, criado_em, atualizado_em;
                 UNIQUE (loja_id, autor_id) (só via RPC)
conversas      — id (uuid), produto_id (SET NULL), produto_nome (cópia), loja_id, comprador_id, vendedor_id, criado_em,
                 ultima_mensagem_em, bloqueada_por, oculta_comprador_em, oculta_vendedor_em; UNIQUE (produto_id, comprador_id) (só via RPC)
mensagens      — id, conversa_id, autor_id, texto (1–2000), cliente_id (uuid UNIQUE, gerado no navegador), criado_em, lida_em,
                 notificado_em (reservado ao push) (só via RPC)
privado.*      — fora da API: config (segredos e prazos de retenção), registros_acesso, conteudo_retido, denuncia_conversa,
                 acessos_admin_chat
```

Relações:
- `usuarios.instituicoes_id → instituicoes.id`
- `lojas.usuario_id → usuarios.id` (1:1)
- `produtos.loja_id → lojas.id`
- `produtos.categoria_id → categorias.id`

Storage (buckets públicos; caminho relativo ao bucket):
- `lojas` — `{lojaId}/avatar.{ext}` e `{lojaId}/capa.{ext}`
- `produtos` — `{produtoId}/imagem.{ext}`
- Escrita: dono da loja/produto ou admin; só JPG/PNG/WebP de até 3 MB (limite no bucket)
- Apagar produto: remover a imagem antes (`removerImagensProduto`), pois a política exige que o produto exista

### Migrações

Aplicadas no projeto de dev, nesta ordem: `setup_completo.sql` (histórico), `00` (alinha banco legado),
`01`, `009`, `02`, `04`, `05` … `30`. Toda mudança de schema vira um arquivo novo em `db/migrations/`.
A `16` (regras do MVP) está documentada em `docs/auditoria-mvp.md`; a `18` é o endurecimento
pós-pentest (grants mínimos, anti-raspagem, cadastro acadêmico no banco, limites e URLs de imagem);
a `19` fixa cada aluno no campus do próprio e-mail (ver "Campus" abaixo); a `20` cria o código do QR code da loja, a `21` libera esse código a qualquer aluno logado, a `22`
cria as RPCs da página do anúncio, a `23` separa nome pessoal e nome de exibição (ver "Nome do aluno") e a `24`
cria perguntas nos anúncios e avaliação do vendedor com moderação externa (ver "Perguntas e avaliações"); a `25`
deixa o autor apagar o próprio comentário e cria a denúncia de comentários; a `26` cria o chat, torna o WhatsApp
opcional e define a retenção e os registros de acesso (ver "Chat" e "Retenção"); a `27` troca a aprovação de matrícula
pela moderação de contas (ver "Moderação de contas"); a `28` cria os dias e horários no campus (`lojas.horarios`) , a `29` deixa o aluno escolher o nome de usuário (ver "Nome do aluno") e a `30` fecha na API três funções internas (triggers de nome e `usuario_publico`).

### Segurança (RLS e triggers)

- **Colunas pessoais** (`email`, `cpf`, `telefone`, `matricula`, `password`) não são
  legíveis via `select` pela API. Logado e visitante leem de `usuarios` só
  `id, instituicoes_id, matricula_status, matricula_validada, criado_em` (nome e sobrenome só pela RPC `meu_usuario()`
  e pelas RPCs de admin, desde a migração 23)
  (`auth_id`, `status` e `is_admin` só pelas RPCs `meu_usuario()`/`is_admin()`).
  Linhas: a própria ou de quem tem anúncio ativo (`usuario_publico()`).
- **Grants mínimos (migração 18)**: `anon`/`authenticated` só têm os privilégios de coluna que o app usa
  (ex.: `usuarios` só `UPDATE` de `nome, sobrenome, matricula, matricula_status, matricula_validada`; `lojas` sem `nome` no `UPDATE`;
  `produtos` sem `destaque`/`loja_id` no `UPDATE`; `categorias`/`instituicoes` só `SELECT`).
  Coluna nova que o cliente precise ler/gravar exige `GRANT` explícito na migração.
  Função de trigger `SECURITY INVOKER` não pode ler colunas ocultas de `usuarios`: use `meu_usuario()`.
- **Código do QR** (`lojas.codigo_compartilhamento`, 12 hex aleatórios) também não é legível por `select`;
  sai por `minha_loja()` (dono) e `perfil_leitura()` (qualquer aluno logado, para compartilhar). Não incluir em selects nem em `GRANT`.
- **Telefone da loja** (`lojas.contato`, `lojas.whatsapp`) não é legível por `select` (nem pelo dono).
  Dono lê pela RPC `minha_loja()`; comprador logado pela RPC `contato_vendedor()`. Não incluir essas colunas em selects.
- Para filtrar o próprio usuário use `auth_id` (nunca `email`).
- Políticas usam os helpers `meu_usuario_id()`, `meu_campus_id()`, `campus_do_usuario()`, `campus_da_loja()`,
  `campus_do_produto()`, `usuario_publico()` e `is_admin()`
  (SECURITY DEFINER) — não referenciar `usuarios` ↔ `lojas` direto em políticas (causa recursão).
  Políticas que usam `meu_usuario_id()`/`is_admin()` são `TO authenticated` (`anon` não executa esses helpers).
- Dono da loja só tem `SELECT`/`UPDATE` na própria loja; a loja nasce só no trigger de signup.
- Catálogo (RLS): só `authenticated` e só o próprio campus (`campus_da_loja(loja_id) = meu_campus_id()`);
  `anon` não tem `SELECT` em `produtos`, `lojas` nem `usuarios`. Produto `ativo`, loja `ativo` e `renovado_em` nos últimos 60 dias
  (espelho: `DIAS_VALIDADE_ANUNCIO` em `src/lib/anuncios.ts` — mudar os dois juntos). Queries de catálogo filtram isso explicitamente
  (e `getProdutosFiltrados` recebe `campus_id`, porque o admin lê tudo pela política de admin).
- Triggers:
  - `handle_new_user` (signup): recusa domínio fora de `instituicoes.dominios`; cria `usuarios` com o campus do domínio
    + loja `ativo` (slug `aluno-{id}`) e grava `termos_aceitos_em`; se já existe linha com o e-mail, só vincula `auth_id`
  - `proteger_colunas_usuarios`: usuário não altera `is_admin`, `auth_id`, `email`, `status`, `termos_aceitos_em`, `instituicoes_id`,
    nem se marca como verificado (só pode voltar `matricula_status` para `pendente`); verificado não muda `matricula`
  - `on_auth_email_change_requested` (auth.users): pedido de troca de e-mail só para domínio cadastrado
  - `on_auth_email_changed` (auth.users): e-mail confirmado sincroniza `usuarios.email` e o campus; mudou de campus, pausa os anúncios
  - `pausar_anuncios_sem_verificacao`: perder `matricula_validada` pausa os anúncios ativos
  - `proteger_status_loja`: dono só alterna `ativo ↔ pausado`, não muda `slug`/`usuario_id`
  - `exigir_vendedor_verificado`: publicar/reativar exige verificado e conta `ativo` (WhatsApp opcional desde a 26); vendedor não altera `destaque`;
    grava `renovado_em` (insert, reativação ou renovação) e `vendido_em`
- RPCs (SECURITY DEFINER), expostas em `queries.ts`:
  - `meu_usuario()` → `getMeuUsuario` (dados completos do usuário logado); `minha_loja()` → `getMinhaLoja`
  - `verificar_matricula_por_email(p_matricula)` → `verificarMatriculaInstantanea`
    (usa o e-mail confirmado do Auth; a instituição vem de `instituicao_por_email()`, que casa o domínio com `instituicoes.dominios`;
    espelho no cliente: `instituicaoDoEmail`/`validarEmailUniversitario` em `src/lib/validacoes.ts`, que recebem a lista do banco)
  - `contato_vendedor(p_loja_id, p_produto_id)` → `getContatoVendedor` (exige login, conta `ativo` e o mesmo campus; registra em `interesses`;
    anti-raspagem: até 30 vendedores diferentes por 24h — erros `PT403`/`PT429` exibidos pelo `BotaoContato`)
  - `perfil_leitura(p_id_ou_slug)` → `getPerfilLeitura` (exige login; perfil + anúncios de qualquer campus, um por vez;
    `mesmo_campus = false` deixa `/perfil/[id]` só leitura; `eh_dono` e `codigo_compartilhamento`)
  - `resumo_loja_compartilhada(p_slug, p_codigo)` → `getResumoLojaCompartilhada` (liberada para `anon`;
    nome da loja e da faculdade só com o código certo, para o `/login?aviso=loja` do QR sem permitir listar alunos)
  - `anuncio_leitura(p_id)` → `getAnuncioLeitura` (exige login; anúncio, loja, campus, `eh_dono`, código e até 8 outros
    da loja; vendido/pausado/vencido volta só com `disponivel = false`, exceto para o dono)
  - `resumo_anuncio_compartilhado(p_id, p_codigo)` → `getResumoAnuncioCompartilhado` (liberada para `anon`; nome, preço e
    foto só com o código da loja dona, para o `/login?aviso=anuncio` e a prévia do WhatsApp)
  - `is_admin()` → usado pelo middleware para liberar `/admin`
  - `denunciar(...)` → `denunciar` (exige login; máx. 10 por dia) · `excluir_minha_conta()` → `excluirMinhaConta`
  - `admin_listar_usuarios()` → `getUsuariosParaModeracao` · `admin_moderar_conta(p_usuario_id, p_acao, p_motivo, p_dias)` → `moderarConta`
    · `admin_historico_conta(p_usuario_id)` → `getHistoricoConta` (`admin_moderar_matricula` segue no banco, sem tela)
  - `minha_situacao_conta()` → `getMinhaSituacaoConta` (prazo e motivo da suspensão/bloqueio para o aviso do painel)
  - `admin_listar_lojas()` / `admin_moderar_loja(p_loja_id, p_status)` / `admin_definir_destaque(p_produto_id, p_destaque)`
  - `admin_listar_denuncias()` / `admin_resolver_denuncia(p_denuncia_id, p_status)` — todas as `admin_*` exigem `is_admin()`
  - `perguntas_do_anuncio(p_produto_id)` → `getPerguntasDoAnuncio` · `avaliacoes_do_vendedor(p_loja_id)` → `getAvaliacoesDoVendedor`
  - `criar_pergunta` / `responder_pergunta` / `avaliar_vendedor`: chamadas só pelas rotas `/api` (o cliente usa
    `enviarPergunta`/`enviarResposta`/`enviarAvaliacao`, que fazem `fetch` nelas)
  - `aplicar_moderacao(p_segredo, …)`: grava a decisão da Vettly; exige `MODERACAO_SEGREDO` (nunca chamar do navegador)
  - `admin_listar_moderacao()` / `admin_moderar_conteudo(p_tipo, p_id, p_aprovado)` → `/admin/comentarios`
    (e o "Remover comentário" de `/admin/denuncias`)
  - `excluir_meu_comentario(p_tipo, p_id)` → `excluirMeuComentario` · `denunciar_comentario(p_tipo, p_id, p_motivo, p_detalhes)`
    → `denunciarComentario` (pelo `BotaoDenunciar` com a prop `comentario`)
  - Chat (migração 26): `iniciar_conversa` → `iniciarConversa` (registra em `interesses`, mesmo limite de 30 vendedores/24h) ·
    `enviar_mensagem` · `minhas_conversas` · `conversa_leitura` · `mensagens_da_conversa` (paginação e reconexão) ·
    `marcar_conversa_lida` · `contar_mensagens_nao_lidas` · `ocultar_conversa` · `bloquear_conversa` ·
    `denunciar_mensagem` (pelo `BotaoDenunciar` com `mensagemId`) · `admin_ler_conversa_denunciada` → `getConversaDenunciada`
  - `registrar_acesso('login')` → `registrarAcesso` (chamado no login; as RPCs do chat registram sozinhas)
  - `anuncio_leitura` e `perfil_leitura` devolvem `tem_whatsapp` (o botão do WhatsApp só aparece com número)
- Cadastro só com e-mail de faculdade participante também no banco: `handle_new_user` rejeita o signup se
  `email_cadastro_permitido()` falhar (= domínio em `instituicoes.dominios`; espelho de `validarEmailUniversitario`).
- Limites de texto/formato são `CHECK` no banco, espelhados em `LIMITES_TEXTO` (`src/lib/validacoes.ts`) como `maxLength`.
  `instagram_url`/`tiktok_url` guardam só o @; links de rede social só via `handleRedeSocial`.
- `avatar_url`, `capa_url` e `imagem_url` só aceitam URL do Storage do próprio projeto, na pasta da própria
  loja/produto (`url_imagem_valida`, host vem do `iss` do JWT) — sempre gravar a URL devolvida pelo upload.
- `/login` mostra só avisos de `AVISOS_LOGIN` (`?aviso=<código>`, via `urlLogin`); nunca texto livre na URL.
- Headers de segurança (CSP, `frame-ancestors 'none'`, HSTS etc.) em `next.config.ts`: domínio externo novo
  de imagem/API precisa entrar na CSP.
- E-mails do Auth: links montados com `{{ .SiteURL }}`, nunca `{{ .RedirectTo }}` (controlado pelo cliente).
- Mudanças de verificação/admin sempre via RPC no banco, nunca por `update` no cliente.
- Admin é definido manualmente: `UPDATE usuarios SET is_admin = true WHERE email = '…';`
- Modos `?preview=1` / `?demo=1` (dados de exemplo) só funcionam com `NODE_ENV=development`.
- Cookies de sessão: clientes de servidor usam `getAll`/`setAll` do `@supabase/ssr`
  (não reescrever com `get`/`set`/`remove`).

### Carga fria (catálogo inicial)

- `db/seed/carga_fria.sql`: os 5 alunos de teste (lojas 1 a 5) viram vendedores da **Unijorge**, com 180 anúncios
  (20 por categoria principal, Trocas incluída). O campus vem do domínio no topo do arquivo; para outra
  instituição da Bahia, trocar o domínio. Está aplicada no banco que o site usa (o mesmo do MCP).
- Fotos: CC0 do Openverse, enviadas ao Storage logado como cada vendedor; créditos em `db/seed/creditos_imagens.json`.
  Reaplicar a carga apaga os anúncios das lojas 1 a 5: remover as fotos deles do Storage antes.
- Contas de tester: `*@example.com`, WhatsApp fictício (DDD 71). A senha é aleatória e não fica no repositório;
  para usar, definir uma nova direto em `auth.users`. Domínio `example.com` não cadastra conta nova.

---

## Regras de negócio

### Atores
- **Visitante** — vê só a home de apresentação (hero + como funciona); catálogo exige login
- **Estudante** — usuário cadastrado; ganha uma loja (perfil vendedor) no cadastro
- **Vendedor** — estudante com `matricula_validada = true` e conta `ativo`; pode publicar anúncios (WhatsApp é opcional)
- **Administrador** — valida matrículas, bloqueia alunos, modera lojas e denúncias, define impulsionados e gerencia imagens

### Acesso
- Catálogo (`/listagem`, `/lojas/*`, `/perfil/*`) exige login (middleware leva ao `/login?aviso=catalogo&next=…`)
- `/mensagens` exige login (middleware leva ao `/login?aviso=mensagens&next=…`)
- `/minha-loja`, `/painel`, `/anunciar` exigem login; `/admin` exige `is_admin`
- Anunciar exige matrícula validada (checado na página e no banco)
- Cadastro exige aceitar Termos de Uso e Política de Privacidade; o aluno pode excluir a conta no painel (Meus dados)
- Matrícula verificada automaticamente pelo e-mail confirmado (o domínio está em `instituicoes.dominios`);
  a equipe não aprova matrícula; modera contas em `/admin/contas`

### Campus
- Cada aluno fica no campus do próprio e-mail: o domínio define `usuarios.instituicoes_id` no cadastro, sem seletor nem filtro
- Cadastro só com domínio de faculdade participante; para abrir uma faculdade nova, cadastrar a instituição com os `dominios`
- Home, listagem e busca mostram só o campus do aluno; a Navbar exibe o campus fixo como "Circular | logo da faculdade"
  (`logoDaFaculdade` em `src/lib/faculdades.ts`; sem logo cadastrado, mostra o nome curto). Busca no centro, Anunciar e conta à direita
- Perfil de outro campus (link compartilhado) abre só leitura: sem WhatsApp nem favoritar; denunciar continua liberado
- QR code da loja: qualquer aluno que abre um perfil público compartilha a loja (PNG, copiar link, compartilhar);
  o dono vê "Compartilhar minha loja", os demais "Compartilhar loja" ao lado do WhatsApp. Visitante que escaneia
  vai para o login com "Entre para ver a loja de X, do campus Y" (middleware usa `aviso=loja` quando o `next` tem código válido)
- Cada anúncio tem página própria: `/anuncio/{id}-{nome}` (`caminhoAnuncio` em `src/lib/compartilhar.ts`); os cards levam a ela.
  De outro campus, só leitura. O link compartilhado leva o código da loja: o login mostra o item e põe `og:*` com foto,
  nome e preço para a prévia do WhatsApp (o WhatsApp segue o redirecionamento do middleware até o login)
- Trocar de campus = trocar o e-mail no painel (Meus dados → E-mail e campus); confirmado o novo e-mail
  (template `db/emails/trocar-email.html`), o campus muda e os anúncios ativos são pausados
- Conta antiga com domínio desconhecido mantém o campus que tinha; sem campus, o onboarding pede a troca de e-mail

### Lojas
- **Uma loja por estudante** (`lojas.usuario_id` UNIQUE) — funciona como perfil de vendedor
- Criada automaticamente no cadastro com `status = 'ativo'`; o aluno não cria nem apaga loja
- Status possíveis: `pendente | ativo | pausado | reprovado`; só `ativo` aparece no catálogo
- Vendedor alterna entre `ativo` e `pausado`; reprovar/reativar é do admin
- Suspender ou bloquear aluno (admin) reprova a loja e pausa os anúncios; reativar volta a loja para `ativo` (anúncios seguem pausados)

### Moderação de contas (migração 27)
- `/admin/contas`: lista todas as contas com situação, anúncios ativos e denúncias abertas contra o aluno; filtros e busca
- **Suspender**: `status = 'bloqueado'` com `usuarios.bloqueado_ate` (1 a 90 dias; a tela oferece `DIAS_SUSPENSAO` de `src/lib/contas.ts`).
  O pg_cron `circular-fim-suspensoes` (`privado.encerrar_suspensoes()`, de hora em hora) reativa no fim do prazo
- **Bloquear**: `status = 'bloqueado'` sem prazo, até a equipe reativar. **Reativar**: volta a `ativo`
- Motivo obrigatório (5 a 300 caracteres, `MOTIVO_MODERACAO`), guardado em `usuarios.moderacao_motivo`: o aluno vê no painel
- Toda ação vai para `moderacoes_conta` (quem, ação, motivo, prazo); o fim automático entra como `fim_suspensao`
- Não modera a própria conta nem a de outro admin. `bloqueado_ate`/`moderacao_motivo` não são legíveis por `select`
- Perfil `pausado` ou `reprovado` mostra aviso no painel; `pausado` tem o botão "Reativar perfil"

### Nome do aluno (migração 23)
- **Nome pessoal** (`usuarios.nome`/`sobrenome`): identidade da conta, vem do cadastro e o aluno corrige no painel
  (`atualizarMeuNome`). Outros alunos não leem; a equipe vê nas telas de admin
- **Nome de exibição** (`lojas.nome_exibicao`, opcional): marca do aluno (ex.: "Bia Doces"), para quem empreende sem
  aparecer com o próprio nome. Regra `nome_exibicao_valido` (2 a 60 caracteres, sem Circular/Admin/Modera…/Suporte/Oficial/Equipe),
  espelhada em `problemaNomeExibicao` (`src/lib/validacoes.ts`) — mudar os dois juntos
- **Nome público** (`lojas.nome`): calculado pelo trigger `definir_nome_publico_loja` = nome de exibição ou nome + sobrenome.
  O app lê sempre `lojas.nome` (cards, anúncio, perfil, QR); nunca gravar direto (sem grant)
- Textos para o aluno falam em "perfil", não em "loja" (a tabela continua `lojas`)
- **Nome de usuário** (`lojas.slug`, migração 29): link do perfil `/perfil/{usuario}` e do QR code. Nasce `aluno-{id}`;
  o aluno escolhe em Meus dados pela RPC `definir_username` (`definirUsername`; `username_disponivel` → `verificarUsername`
  checa ao sair do campo). Regra `username_formato_valido` (3 a 30, a-z 0-9 e `. _ -` entre eles, não só número) + reservados
  (`aluno-<n>`, Circular/Admin/Modera…/Suporte/Oficial/Equipe), espelhada em `problemaUsername` (`src/lib/username.ts`) —
  mudar os dois juntos. Primeira troca livre, depois 1 a cada 30 dias (`username_alterado_em`). O endereço anterior vai para
  `lojas_slugs_antigos` (só RPC): `perfil_leitura` devolve `{redirecionar}` e `/perfil/[id]` redireciona (também id numérico
  e maiúsculas), mantendo `?c=`; `resumo_loja_compartilhada` aceita o endereço antigo. O slug não tem `GRANT` de `UPDATE`
- **Dias e horários no campus** (`lojas.horarios`, migração 28): o aluno marca em Meus dados (`EditorHorarios`, até 2 faixas por dia);
  aparecem no perfil e no anúncio (`HorariosCampus`, agrupando dias seguidos). Regra do banco `horarios_validos()`
  espelhada em `problemaHorarios` (`src/lib/horarios.ts`): até 14 faixas, início antes do fim, sem sobreposição — mudar os dois juntos

### Perguntas e avaliações (migração 24)
- **Perguntas**: aluno do mesmo campus pergunta no anúncio disponível (até 20 por dia); só o dono responde, uma vez
  (se a resposta for recusada, pode escrever outra). Pergunta e resposta nascem `pendente`
- **Avaliação**: nota de 1 a 5 no perfil do vendedor, com comentário opcional; uma por aluno e vendedor (reenviar atualiza).
  Só quem tem registro em `interesses` com aquele vendedor (clicou em "Tenho interesse") e não é o dono.
  Sem comentário a nota vale na hora; com comentário, espera a moderação. Média só com avaliações aprovadas
- **Moderação**: a rota `/api` manda o texto à Vettly (`POST /v1/check`, idioma `pt`, política `marketplace`) **antes** de gravar.
  `block` recusa e **nada é gravado** (avaliação anterior do aluno fica como estava); `allow` grava pela RPC e publica com
  `aplicar_moderacao`; falha, chave ausente ou `flag` grava `pendente` na fila de `/admin/comentarios`.
  A mensagem ao aluno traz o motivo (categorias com `triggered` → `motivosEmTexto` em `src/lib/moderacao.ts`;
  categoria nova da política precisa de texto lá). Autor vê o status do que enviou; os outros só o aprovado
- Comentários: perguntas e avaliações mostram 3 e o resto no "Ver mais"
- **Apagar**: o autor apaga a própria pergunta (a resposta vai junto) ou avaliação; o dono do anúncio apaga a própria resposta
- **Denunciar comentário** (migração 25): qualquer aluno logado denuncia pergunta, resposta ou avaliação publicada de outra
  pessoa (uma denúncia aberta por comentário; limite de 10 denúncias por dia junto com anúncios/perfis). A denúncia guarda
  uma cópia do texto, que continua na fila mesmo se o autor apagar. Em `/admin/denuncias`, aba Comentários, "Remover
  comentário" tira do site (fica `recusado`) e resolve a denúncia
- A Vettly recebe só o texto (sem nome, e-mail ou telefone); está citada na Política de Privacidade
- Conteúdo de aluno bloqueado some das listas e da média

### Produtos
- Apenas o dono da loja (ou admin) gerencia seus produtos
- Status: `ativo | pausado | vendido`; aparece no catálogo só se produto **e** loja estiverem `ativo`
  e o anúncio foi renovado nos últimos 60 dias (reativar ou editar também renova)
- Preço > 0 para venda; anúncio só de troca pode ter preço 0 (`aceita_troca = true`) — `CHECK` no banco
- Perder a verificação ou ser bloqueado pausa os anúncios ativos
- Qualquer aluno logado pode denunciar anúncio ou perfil; o admin trata em `/admin/denuncias`
- `destaque` = impulsionado na home, definido só pelo admin
- Imagem via upload (Supabase Storage)

### Compra
- Plataforma apenas conecta comprador e vendedor
- Dois canais, só para logados do mesmo campus: **chat do Circular** (sempre; "Tenho interesse" no anúncio, via `BotaoConversar`)
  e **WhatsApp** (`https://wa.me/{telefone}`, via `BotaoContato`, só se o vendedor cadastrou o número).
  Abrir conversa ou clicar no WhatsApp vira registro em `interesses` (métrica do MVP e requisito da avaliação)
- `lojas.contato` armazena apenas dígitos do telefone (DDI + DDD + número);
  use os helpers de `src/lib/contato.ts` para gerar link e formatar
- Sem carrinho, pedido ou pagamento interno

### Chat (migração 26)
- Uma conversa por anúncio e comprador. Gravação e leitura só por RPC; o trigger `publicar_mensagem` publica cada mensagem
  com `realtime.send()` em canais **privados** (autorização por RLS em `realtime.messages`, função `pode_usar_topico_realtime`):
  `conversa:{uuid}` (mensagem, lida, bloqueio; só o banco publica), `conversa:{uuid}:digitando` (os participantes publicam)
  e `usuario:{id}` (nova_mensagem, conversa_lida). Espelho dos nomes: `topicoConversa`/`topicoDigitando`/`topicoUsuario` em `src/lib/chat.ts`
- Cliente: `src/lib/chat-realtime.ts` (`assinarConversa`, `assinarUsuario`; um canal `usuario:` compartilhado entre Navbar e caixa de entrada).
  A cada `SUBSCRIBED` busca o que faltou (`mensagens_da_conversa` com `p_depois`), porque o Broadcast não reenvia o que se perdeu offline.
  `cliente_id` (uuid do navegador) deixa o reenvio idempotente. `CaixaEntrada` e `ConversaChat` assinam o Realtime e recarregam
  dados em eventos: exceção à regra "componente não faz fetch" (como a Navbar); a carga inicial continua no `getServerSideProps`
- Sem moderação automática. Limites: 20 mensagens/min e 500/dia por aluno; texto de 1 a 2000 caracteres (`LIMITES_TEXTO.mensagemChat`)
- Bloquear: ninguém envia mais nada; só quem bloqueou desbloqueia. Apagar conversa: some só da lista do aluno e volta com mensagem nova
- Denúncia de mensagem: guarda o texto e uma cópia da conversa (até 500 mensagens) em `privado.denuncia_conversa`.
  O admin **não** lê as tabelas do chat: só a cópia, por `admin_ler_conversa_denunciada`, e cada leitura fica em `privado.acessos_admin_chat`
- Realtime: em Project Settings → Realtime, deixar desligado "Allow public access" (só canais privados)
- Push (OneSignal) ainda não existe; a coluna `mensagens.notificado_em` está reservada para ele

### Retenção e registros de acesso (migração 26)
- Prazos em `privado.config` (`retencao_conteudo_dias` = 30, `retencao_registros_acesso_dias` = 180); job diário do `pg_cron`
  `circular-retencao` chama `privado.limpar_retencao()`
- Conversa sem mensagem nova há 30 dias é apagada (menos as com denúncia aberta)
- Excluir conta: tudo sai do site na hora; `excluir_minha_conta` grava antes uma cópia (perfil, anúncios, perguntas,
  respostas, avaliações, conversas) em `privado.conteudo_retido`, apagada após 30 dias
- Denúncia de mensagem resolvida/descartada: a cópia da conversa e o texto denunciado são apagados 30 dias depois (`denuncias.resolvida_em`)
- Registros de acesso (Marco Civil, art. 15: mínimo de 6 meses): `privado.registros_acesso` com IP (`cf-connecting-ip`/`x-forwarded-for`
  repassados pelo gateway do Supabase), data, hora e user agent, gravados no login e no chat (no máximo 1 por evento e IP a cada 10 min)

### Ajuda e e-mail da faculdade
- Depois do cadastro e do "esqueci a senha", a tela `ConfiraEmail` mostra o botão para abrir o Outlook/Gmail
  da faculdade, onde procurar o e-mail, reenviar o link e corrigir o endereço; o login reenvia a confirmação
- Faculdade nova: adicionar o domínio em `GUIAS_POR_DOMINIO` (provedor pelo MX). Formato do endereço,
  primeiro acesso e suporte só entram quando confirmados com alunos; sem eles vale o texto genérico
- Pendências (domínios suspeitos, detalhes por faculdade, prints, canal de suporte): `docs/pendencias-ajuda.md`

### Fora do escopo desta versão
- Pagamento interno, notificações por email, push do chat (OneSignal, planejado)

---

## Regras de desenvolvimento

### Geral
- Não instalar novas dependências sem perguntar
- Não criar abstrações desnecessárias — código simples e direto
- Não usar Context API, Zustand, Redux ou qualquer gerenciador de estado global
- Não usar axios — cliente Supabase ou fetch nativo
- Não usar bibliotecas de componentes (shadcn, radix, MUI, etc.); ícones só de `lucide-react`
- Sempre tipar com as interfaces de `src/types/index.ts`

### Fetch de dados
- Dados iniciais sempre via `getServerSideProps` nas pages — nunca `useEffect` para isso
- Pages não chamam o Supabase diretamente para dados — usar funções de `src/lib/queries.ts`
  (exceção: `supabase.auth.*` em login, cadastro e recuperação de senha)
- Sempre tratar erros com `if (error) throw error`

### Testes
- `npm test` roda `node --test` em `src/lib/__tests__/*.test.ts` (sem dependências extras)
- Funções puras de `src/lib` (validações, formatação) devem ter teste; imports nos testes usam extensão `.ts`

### Títulos das páginas
- Rota nova ganha título em `src/lib/titulos.ts`; título dinâmico vai no `<Head>` da página
- `<title>` sempre com um texto só: `{`${nome} • Circular`}` (misturar `{nome} • Circular` vira vários filhos e o navegador mostra a URL)

### Componentes
- Props sempre tipadas com `interface Props`
- Exportação sempre `export default function NomeComponente`
- Componentes recebem dados via props — não fazem fetch
  (exceção: `Navbar`, layout global que reage a login/logout; usa `getResumoUsuarioNavbar` no cliente)
- Mutações disparadas por eventos (salvar, pausar, favoritar) chamam funções de `queries.ts`/`storage.ts`
- Nunca `confirm()`/`alert()`/`prompt()` do navegador: ação destrutiva pede confirmação com `useConfirmacao`
  (`src/components/ModalConfirmacao.tsx`, `perigo: true` para excluir/bloquear); erro aparece na tela (`role="alert"`)

---

## Agentes e orquestração

Este arquivo prevalece sobre qualquer outra instrução de equipe (inclusive a pasta `AI-TEAM/`, que é referência genérica).
Lucas é o dono do produto e decide escopo, visão e tudo que for irreversível.

### Quando delegar (do mais barato ao mais caro)
1. **Sessão única** (padrão): bug, ajuste de tela, migração pequena, texto. Não delegar o que dá para fazer direto.
2. **Subagente na própria sessão**:
   - `Explore` (embutido) para busca ampla só leitura, quando só a conclusão importa
   - `product-manager` (`.claude/agents/`): dono do produto. Define problema, escopo e critérios de aceite antes de
     feature média ou grande, analisa decisões e mantém `docs/produto/` (decisões, roadmap, specs, métricas) e as
     Regras de negócio deste arquivo. Ao fim de uma entrega que muda o produto, chamar para registrar
   - `tech-lead` (`.claude/agents/`) para uma parte técnica isolada, em arquivos que a sessão principal não está editando;
     aplica migrações no banco de produção
   - `qa-engineer` (Sonnet) para validar mudança de risco: RLS, migração, auth, chat, moderação, dados pessoais
3. **Worker do Orca** (skill `orchestration`; ler a skill antes, sem inventar flags): só quando precisar de outro
   agente (ex.: Codex revisando o que o Claude fez), de worktree próprio para implementar em paralelo, ou de tarefa longa
   que não cabe na sessão. Para entregar sem esperar retorno, usar `orca-cli` (handoff)
- UX e marketing: usar as skills instaladas (`design:*`, `marketing:*`), não agentes próprios
- `code-review` em nível `low`/`medium` por padrão; `max`/`ultra` só a pedido do Lucas

### Economia
- No máximo **2 workers** ao mesmo tempo; 3 só com tarefas grandes e independentes. Nunca dois no mesmo arquivo
- Tarefa delegada é curta: objetivo, arquivos permitidos, critério de aceite e o que não fazer. Aponte arquivos
  e seções deste `CLAUDE.md` em vez de colar conteúdo (o worker já carrega este arquivo)
- Entrega do agente em poucas linhas: arquivos, verificações e resultado, riscos. Sem diffs nem logs inteiros
- Revisão cruzada (QA ou outro agente) só onde o risco justifica, não em toda tarefa
- Não declarar delegação que não aconteceu: se fez direto, diga que fez direto

### Banco de produção
- O Supabase do MCP é produção. A sessão principal e o `tech-lead` estão autorizados a aplicar migrações e rodar SQL:
  schema sempre por arquivo em `db/migrations/` + `apply_migration`, conferindo `get_advisors` depois.
  `product-manager` só lê (`SELECT` agregado); `qa-engineer` não acessa
- Continua exigindo ok do Lucas: apagar ou sobrescrever dado de aluno sem volta (`DROP` com dado, `DELETE`/`UPDATE` em massa,
  `TRUNCATE`) que a tarefa não pediu com todas as letras

### Exige autorização explícita do Lucas
- Deploy/merge em `main`, push, mudança na Vercel, Cloudflare, DNS, Resend ou painel do Supabase
- E-mail, mensagem ou publicação para terceiros; gasto ou serviço novo; dependência nova
- Expor, copiar ou girar segredos (`.env*`, `MODERACAO_SEGREDO`, chaves da Vettly)
- **Dados pessoais (LGPD)**: nada de CPF, telefone, e-mail, matrícula, conversas ou registros de acesso de alunos reais
  em mensagens entre agentes, arquivos de memória, testes, prints ou relatórios. Consulta a esses dados, só agregada e com motivo

---

## Design system — Circular

Antes de criar ou alterar qualquer UI, leia `DESIGN_SYSTEM.md`. Use apenas os tokens do `@theme`
em `src/styles/globals.css`; não use hex soltos nem as cores padrão do Tailwind.

- Marca: **Circular** · slogan "Deixa Circular." · logo via `src/components/Logo.tsx`
- Ícones: `lucide-react` (stroke 1.75, 16–20px); **sem emojis na interface**
- Uma ação principal por tela em `bg-acao`; demais botões no padrão secundário
- Selo de verificado: `src/components/SeloVerificado.tsx` (só o escudo; tocar explica o que é; é botão, não pode ficar dentro de link)
- Ícone de categoria: `iconeParaCategoria` em `src/lib/icones-categoria.ts` (a coluna `categorias.icone` guarda emoji e não é exibida)
- Todas as lojas seguem a identidade do site (não há cor por loja)
- Hero da home (`HeroSection`): cada slide tem foto de fundo em `public/hero/` (WebP 1600px, CC0; créditos em
  `public/hero/creditos.json`) sob degradê `petroleo-900` para o texto branco ficar legível. Os textos de todos os slides
  ficam empilhados na mesma célula do grid (inativos `invisible`), então a altura do carrossel é a do slide mais longo e não pula
- Manifesto do Modo Trocar (`SecaoTrocas`) usa o mesmo padrão: foto `public/hero/trocas.webp` sob degradê `petroleo-900`
