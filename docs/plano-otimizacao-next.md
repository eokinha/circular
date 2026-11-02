# Plano de otimização de performance — Circular (Next.js Page Router)

Base: skill `vercel-react-best-practices` (70 regras, 8 categorias), aplicada ao código da branch
`eokinha/relatorio-skills` (Next 16.4.3 com Turbopack, React 19.2.4, `@supabase/ssr` 0.10.2,
`@supabase/supabase-js` 2.104.1). Medições feitas em 02/11/2026: build local e páginas públicas de
produção (`https://circular.eokinha.com.br`), sem login e sem envio de formulário.

---

## 1. Resumo

O JavaScript do próprio app é razoável: 174 KB gzip compartilhados (`_app`) e no máximo 23 KB a mais por
rota. O tempo se perde em três lugares:

1. **Latência de servidor.** As funções da Vercel rodam em `iad1` (Washington), segundo o header
   `x-vercel-id: gru1::iad1::…`. O banco parece estar em São Paulo (o host `db.<ref>.supabase.co` resolve
   para `2600:1f1e:…`, faixa IPv6 da AWS em `sa-east-1`). Cada ida ao Supabase cruza o continente, e as
   páginas fazem de 2 a 7 idas **em sequência**. Uma página SSR com uma consulta só (`/cadastro`, `/ajuda`)
   leva cerca de 0,75 s de TTFB; uma página estática leva cerca de 0,19 s.
2. **Trabalho repetido por requisição.** O middleware chama `auth.getUser()` (ida ao servidor de Auth) em
   toda requisição, inclusive imagens de `public/` e `/_next/data`. Depois o `getServerSideProps` chama
   `getUser()` de novo. A `Navbar` busca de novo, no cliente, o resumo do usuário (2 idas, e 2 vezes por
   navegação por causa de um efeito que dispara a cada troca de rota).
3. **Terceiros e imagens.** O gtag (GA4) transfere 182 KB gzip e o AdSense 206 KB, mais que todo o JS do
   app, em todas as páginas, inclusive painel e chat. As fotos dos anúncios são JPEG de 1024×1024 (56 a
   362 KB), carregadas sem `loading="lazy"`, para cards de cerca de 250 px. O hero baixa as 4 fotos (373 KB)
   logo de cara.

A maior parte dos ganhos não exige dependência nova nem fere o `CLAUDE.md`. As exceções estão marcadas na
tabela.

---

## 2. Números medidos (antes)

### 2.1 Build local

`NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=… npx next build`: **compilou sem erro**
(TypeScript 4,4 s, compilação 3,4 s). Avisos:

- `The "middleware" file convention is deprecated. Please use "proxy" instead.`
- 7 rotas estáticas (`○`): `/404`, `/confirmar-email`, `/esqueci-senha`, `/privacidade`, `/redefinir-senha`,
  `/termos` (e `/500`). Todas as outras são `ƒ` (SSR por requisição), inclusive `/ajuda`, `/cadastro`, `/login` e `/`.

O Turbopack não imprime "First Load JS". Somei com gzip -9 os chunks de `.next/build-manifest.json`, que são
os mesmos `<script>` que aparecem no HTML de `/termos`:

| Pacote | gzip |
|---|---|
| `_app` (compartilhado em toda rota) | **173,8 KB** (584,8 KB sem compressão) |
| — react-dom + runtime do Next | 64,6 KB + 15,3 KB + 13,2 KB + 7,9 KB |
| — supabase-js (GoTrue, PostgREST, Storage, **Realtime/phoenix**) | **59,0 KB** |
| — ícones lucide (Navbar e menu) | 10,0 KB |
| CSS global (Tailwind) | 9,1 KB (produção) |
| Fonte Plus Jakarta (1 woff2 com preload) | 27,3 KB |

First Load JS por rota (gzip, `_app` + chunk da página + chunks referenciados):

| Rota | Página | First Load |
|---|---|---|
| `/anuncio/[id]` | 14,9 KB (+8,7 KB do `qrcode`, já sob demanda) | 197,4 KB |
| `/perfil/[id]` | 14,4 KB (+8,6 KB do `qrcode`) | 196,8 KB |
| `/painel/*` (4 abas, mesmo chunk) | 16,6 KB | 190,3 KB |
| `/` | 11,3 KB | 185,1 KB |
| `/mensagens/[id]` | 8,8 KB | 182,6 KB |
| `/anunciar` | 7,9 KB | 181,7 KB |
| `/ajuda` | 7,0 KB | 180,8 KB |
| `/listagem` | 5,1 KB | 178,9 KB |
| `/login` | 2,7 KB | 176,5 KB |
| `/termos` | 1,9 KB | 175,7 KB |

Em produção, o JS da home (`/`) transfere **187 KB** (soma dos `<script>` do HTML com `Accept-Encoding: gzip`),
o que confere com a conta local.

ESLint: 2 avisos `@next/next/no-img-element` (`src/components/Navbar.tsx:177` e `:258`). As outras 21 `<img>`
têm `eslint-disable`. Só 1 das 23 usa `loading="lazy"` (`src/components/SecaoTrocas.tsx:177`).

### 2.2 Produção (curl, 5 amostras, visitante)

| Rota | Tipo | TTFB (s) | `x-vercel-cache` | `Cache-Control` |
|---|---|---|---|---|
| `/privacidade` | estática | 0,18–0,35 | HIT | `public, max-age=0, must-revalidate` |
| `/esqueci-senha` | estática | 0,19–0,36 | HIT | idem |
| `/` (visitante) | SSR, sem consulta | 0,32–0,36 | MISS | `private, no-cache, no-store…` |
| `/login` | SSR, sem consulta | 0,30–0,38 | MISS | idem |
| `/ajuda` | SSR, 1 consulta (`instituicoes`) | 0,48–1,11 | MISS | idem |
| `/cadastro` | SSR, 1 consulta (`instituicoes`) | 0,73–1,12 | MISS | idem |

Uma consulta ao Supabase dentro do SSR soma de 0,4 a 0,5 s ao TTFB. É o sinal mais claro da distância
`iad1` ↔ `sa-east-1`.

Assets e terceiros:

| Recurso | Tamanho | Cache |
|---|---|---|
| `/hero/negocie.webp` (LCP da home) | 120 KB; as 4 fotos do hero somam 373 KB | `public, max-age=30, must-revalidate`, **sempre MISS** |
| `/faculdades/unijorge.svg` | 12 KB | `max-age=30`, MISS |
| Foto de anúncio no Storage (amostras ids 100/150/200/250) | 362 / 56 / 89 / 80 KB, JPEG **1024×1024** | `public, max-age=3600` |
| `/_next/static/immutable/chunks/*` | — | `max-age=31536000, immutable` (ok) |
| `gtag/js?id=G-7HJT8QR82M` | **182 KB gzip** | terceiro |
| `adsbygoogle.js?client=…` | **206 KB** (veio sem `Content-Encoding` no curl) | terceiro |

A transformação de imagem do Supabase (`/storage/v1/render/image/…`) responde **403**: não está habilitada
no plano atual.

---

## 3. Achados

Impacto: alto / médio / baixo. Esforço: P (horas), M (1–2 dias), G (mais que isso).
A coluna "Conflito" aponta a regra do `CLAUDE.md` envolvida, quando há.

| # | Regra da skill | Onde | Achado | Impacto | Esforço | Conflito com `CLAUDE.md` |
|---|---|---|---|---|---|---|
| A1 | `async-parallel` (latência por ida) | Vercel → Settings → Functions → Region (sem `vercel.json` no repo) | Funções em `iad1`, banco provavelmente em `sa-east-1`: cada ida custa cerca de 120 ms a mais | **alto** | P | não |
| A2 | `async-parallel` | `src/lib/painel-data.ts:130-136` | 6 `await` em sequência (loja → produtos → favoritos → usuário → instituições → situação), depois do `getUser` da linha 58. Com dependência real, cabem em 2 rodadas | **alto** | P | não |
| A3 | `async-defer-await` / `async-dependencies` | `src/middleware.ts:39` | `auth.getUser()` (ida ao Auth) em **toda** requisição que passa no matcher. O projeto usa chave assimétrica ES256 (JWKS público), então `getClaims()` valida o JWT localmente | **alto** | P | regra de segurança: ver risco R1 |
| A4 | `bundle-conditional` (escopo do middleware) | `src/middleware.ts:100` | O matcher só exclui `_next/static`, `_next/image` e `favicon.ico`. Arquivos de `public/` (`/hero/*.webp`, `/brand/*.svg`, `/faculdades/*.svg`, `ads.txt`) e `/api/*` passam pelo middleware. Para quem está logado, cada imagem gera um `getUser()` | **alto** | P | não |
| A5 | `async-parallel` + `server-parallel-fetching` | `src/pages/index.tsx:25,41,44-51` | Home logada: `getUser` → `getResumoUsuarioNavbar` (2 idas em série, `queries.ts:557-564`) → `Promise.all`. São 4 rodadas, mais o `getUser` do middleware. `getCategorias` e `getMeusFavoritosIds` não dependem do campus e podem sair já na 1ª rodada | **alto** | P | não |
| A6 | `client-swr-dedup` / `rerender-dependencies` | `src/components/Navbar.tsx:44-109` | O efeito depende de `[router]`. No Page Router, `makePublicRouterInstance` cria um objeto novo a cada render do `AppContainer` (`node_modules/next/dist/client/router.js:152`), então o efeito roda de novo a cada navegação. Cada rodada faz `getSession` + `fetchUserData`, e o `onAuthStateChange` (re-inscrito) dispara `INITIAL_SESSION` com outro `fetchUserData`: cerca de 6 requisições ao Supabase por navegação só para a Navbar | **alto** | P | não (a `Navbar` continua buscando no cliente, que é a exceção do `CLAUDE.md`) |
| A7 | `server-dedup-props` (versão Page Router) | `src/pages/index.tsx:41`, `src/pages/listagem.tsx:63` + `Navbar.tsx:47` | O resumo do usuário é buscado no SSR e de novo no cliente pela Navbar na mesma página | médio | P | não: a página passa o resumo nas `pageProps` e a Navbar o recebe por prop do `_app`, sem estado global |
| A8 | `bundle-defer-third-party` | `src/pages/_app.tsx:23-31` (AdSense), `:40-51` (GA4) | AdSense (206 KB) entra em toda página do host de produção, inclusive `/painel`, `/mensagens` e `/admin`, e o código não tem nenhum slot (`<ins class="adsbygoogle">`): só Auto Ads. O GA4 usa `afterInteractive` (182 KB gzip) | **alto** | P | não |
| A9 | `rendering-*` / LCP (imagens) | `src/components/CardProduto.tsx:80`, `:146`; `src/lib/storage.ts:44` | Cards sem `loading="lazy"` nem `width`/`height`/`sizes`. A foto original 1024×1024 (até 362 KB) vai para um card de cerca de 250 px. A `/listagem` com 40 cards pode passar de 4 MB de imagem. Upload com `cacheControl: "3600"`, embora a URL já carregue `?v=timestamp` | **alto** | M | `next/image` não é dependência nova, mas tem custo no plano da Vercel (R3) |
| A10 | `rendering-resource-hints` / LCP | `src/components/HeroSection.tsx:217-229` | As 4 fotos do hero são montadas de saída (373 KB). Só a 1ª tem `fetchPriority="high"`, as outras baixam junto. São sempre 1600 px, inclusive no celular | médio | P | não |
| A11 | cache de assets | `next.config.ts:58-75` (só headers de segurança) | Arquivos de `public/` saem com `max-age=30, must-revalidate` e dão MISS sempre, porque o middleware está na frente (A4) | médio | P | não |
| A12 | estático/ISR (`getStaticProps` + `revalidate`) | `src/pages/ajuda.tsx:17-20`, `src/pages/cadastro.tsx:26-28` | Única consulta: `instituicoes` (pública, muda raramente). TTFB de 0,75 s contra 0,19 s de uma página estática | médio | P | **sim**: "dados iniciais via `getServerSideProps`". Pede exceção registrada no `CLAUDE.md` |
| A13 | `server-serialization` (equivale ao `__NEXT_DATA__`) | `src/lib/queries.ts:456-460`, `:414-418` | O select do catálogo traz `descricao`, `lojas.descricao` e `capa_url`, que o `CardProduto` não usa. Vão no `__NEXT_DATA__` da home (até 60 + 60 produtos), da `/listagem` (41) e do painel | médio | P | não |
| A14 | `async-parallel` | `src/pages/anunciar.tsx:109-121` | `getMeuProduto`/`getMeuUsuario` → `getMinhaLoja` → `getCategoriasArvore` em série. A loja e as categorias não dependem do resto | médio | P | não |
| A15 | `async-parallel` | `src/pages/mensagens/index.tsx:15-19` | `getMeuUsuario` → `getMinhasConversas` em série. Pode ser `Promise.all` (a RPC já exige login) | baixo | P | não |
| A16 | `async-dependencies` | `src/pages/perfil/[id].tsx:68-78`, `src/pages/anuncio/[id].tsx:63-83` | 2ª rodada (avaliações; perguntas) depois da leitura. No anúncio, `getPerguntasDoAnuncio(id)` só precisa do `id` e pode entrar na 1ª rodada. A avaliação depende de `loja.id`: tirar a 2ª rodada exige a RPC devolver a nota | baixo/médio | P (perguntas) / M (RPC) | mudança de RPC vira migração nova |
| A17 | `client-swr-dedup` | `src/components/Navbar.tsx:127` | `contarMensagensNaoLidas()` a cada `routeChangeComplete`, além do Realtime, que já avisa de mensagem nova e de conversa lida | baixo | P | não |
| A18 | `bundle-dynamic-imports` | `src/components/painel/PainelEstudante.tsx` (importa `SecaoPerfil`, 767 linhas, `SecaoAnuncios`, `SecaoFavoritos`) | As 4 abas do painel baixam o mesmo chunk de 16,6 KB. A aba ativa vem da rota, então as outras seções podem ser `next/dynamic` | baixo | P | não |
| A19 | `bundle-conditional` | `src/pages/_app.tsx:52` → `Navbar.tsx:4-6` → `src/lib/supabase.ts:23` | supabase-js inteiro (59 KB, com o cliente Realtime) no `_app` de toda rota, até em `/termos` e `/privacidade`. Ganho real só nas rotas que não importam `queries.ts` (as estáticas e o login/cadastro de visitante) | baixo/médio | M | não |
| A20 | proxy (Next 16) | `src/middleware.ts` | Convenção `middleware` deprecada no Next 16. `proxy.ts` roda só em Node.js (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md:596-619`) | baixo (manutenção) | P | não |
| A21 | `js-set-map-lookups` | `index.tsx:217`, `listagem.tsx:177`, `perfil/[id].tsx:319`, `anuncio/[id].tsx:375`, `SecaoTrocas.tsx:268` | `favoritos.includes(produto.id)` dentro de `map`: O(n·m) | baixo | P | não |
| A22 | `client-passive-event-listeners` | `src/components/SeloVerificado.tsx:49` | `scroll` em captura sem `{ passive: true }` (só com o balão aberto) | baixo | P | não |

### Já está bom (sem ação)

- `qrcode` já entra por `import()` sob demanda (`src/components/BotaoCompartilhar.tsx:53`), em chunk separado de cerca de 8,7 KB.
- `lucide-react` está em `optimizePackageImports` por padrão (`node_modules/next/dist/server/config.js:970`), e o chunk de ícones tem 10 KB.
- Fonte via `next/font` (1 arquivo woff2 com preload, `display: swap` padrão, variável CSS `--font-jakarta`).
- GA4 via `next/script` com `afterInteractive`, depois da hidratação.
- `/listagem` pagina em 40 itens (`POR_PAGINA`, `listagem.tsx:32`): os 180 anúncios da carga fria não chegam de uma vez.
- Chunks em `/_next/static/immutable/` com `max-age=31536000, immutable`.
- Realtime: um canal por usuário compartilhado entre Navbar e caixa de entrada (`src/lib/chat-realtime.ts:93-133`), recarga com debounce de 300 ms (`CaixaEntrada.tsx:29-45`) e "digitando" limitado a 1 aviso a cada 2 s.
- Hero com `<link rel="preload" as="image" fetchPriority="high">` para a 1ª foto (está no HTML de produção).

### Regras que não se aplicam (Page Router, sem RSC)

`async-suspense-boundaries` (streaming de RSC), `server-cache-react` (`React.cache` é para RSC; no
`getServerSideProps` cada chamada já é uma requisição), `server-dedup-props` e `server-serialization` na forma
de RSC (usei a versão para `__NEXT_DATA__`), `server-auth-actions` (não há Server Actions),
`server-after-nonblocking` (`after()` não existe no `getServerSideProps`; no proxy o equivalente é
`event.waitUntil`, sem uso hoje), `server-no-shared-module-state` (o singleton `supabase` de `lib/supabase.ts`
só é usado no navegador; no servidor cada página cria o próprio cliente: sem problema).
`client-swr-dedup` com SWR **exige aprovação** (dependência nova); as correções abaixo não usam SWR.

---

## 4. Plano em fases

Cada item diz o que mudar e como medir. Medição padrão: TTFB com
`curl -w "%{time_starttransfer}"` (5 amostras), aba Network do DevTools logado (número de requisições ao
`*.supabase.co` por navegação) e PageSpeed Insights (mobile) para LCP/TBT nas rotas públicas.

### Fase 0 — Configuração, sem código (1 hora)

**0.1 Região das funções (A1).** Confirmar a região do projeto Supabase (Dashboard → Settings → General).
Se for `sa-east-1`, trocar a região das funções na Vercel para `gru1` (Settings → Functions → Function Region).
- Medir: TTFB de `/cadastro` e `/ajuda` antes (0,73–1,12 s) e depois. Esperado: perto de 0,3 s. O ganho se
  multiplica nas páginas logadas, que fazem de 3 a 7 idas.

### Fase 1 — Ganhos rápidos (1–2 dias)

**1.1 Matcher do middleware (A4, A11).** Em `src/middleware.ts:100`, excluir arquivos de `public/` e `/api`
(as rotas `/api` já autenticam em `src/lib/api-rotas.ts:36`), por exemplo
`"/((?!api|_next/static|_next/image|favicon.ico|ads.txt|hero/|brand/|faculdades/|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt)$).*)"`.
`/_next/data` continua passando, como diz a doc do proxy.
- Medir: `x-vercel-cache` de `/hero/negocie.webp` passa a dar HIT na 2ª requisição. No log da Vercel, invocações
  de middleware por página vista.

**1.2 `getClaims()` no middleware (A3).** Trocar `supabase.auth.getUser()` (`middleware.ts:39`) por
`supabase.auth.getClaims()` e usar `data?.claims?.sub` como "logado". O `getClaims` chama `getSession`, que
renova o token vencido e grava os cookies pelo `setAll`, então a renovação de sessão continua. Manter a RPC
`is_admin` para `/admin`.
- Medir: Network/Logs do Auth no Supabase (requisições `GET /auth/v1/user` por página) e TTFB logado das
  páginas do catálogo.

**1.3 Navbar sem refetch por navegação (A6, A17).** Em `src/components/Navbar.tsx:109`, tirar `router` das
dependências do efeito: ler `router.pathname` dentro do callback por `useRef`, ou mover o redirecionamento ao
`/onboarding` para um efeito próprio com `[router.pathname]`. Não chamar `fetchUserData` duas vezes no início:
o `onAuthStateChange` já entrega `INITIAL_SESSION`, então o `getSession().then(...)` da linha 73 pode sair.
Tirar o `routeChangeComplete` da linha 127, já que o Realtime e o `onSincronizar` cobrem o contador.
- Medir: DevTools logado, navegar Home → Listagem → Anúncio. Hoje são cerca de 6 requisições da Navbar por
  navegação (`meu_usuario`, `minha_loja`, `instituicoes`, ×2) mais `contar_mensagens_nao_lidas`. Meta: 0 por
  navegação e 3 só na carga inicial.

**1.4 Paralelizar `getServerSideProps` (A2, A5, A14, A15, A16-perguntas).**
- `src/lib/painel-data.ts:130-136`: rodada 1 =
  `Promise.all([getMinhaLoja, getMeuUsuario, getInstituicoes, getMinhaSituacaoConta().catch(…)])`; rodada 2 =
  `Promise.all([getProdutosPrivados(loja.id), getProdutosFavoritos(loja.usuario_id)])`. De 7 idas em série para 3.
- `src/pages/index.tsx:41-51`: disparar `getCategorias` e `getMeusFavoritosIds` junto com
  `getResumoUsuarioNavbar` e esperar o campus só para os dois `getProdutosFiltrados`.
- `src/pages/anunciar.tsx:109-121`: `getMinhaLoja` e `getCategoriasArvore` em `Promise.all` com o
  `getMeuProduto`/`getMeuUsuario`.
- `src/pages/mensagens/index.tsx:15-19`: `Promise.all([getMeuUsuario, getMinhasConversas])` (tratar o erro do
  segundo quando não houver usuário).
- `src/pages/anuncio/[id].tsx:63`: incluir `getPerguntasDoAnuncio(id)` na 1ª rodada.
- Opcional: nas páginas cujo `getUser()` só decide o redirecionamento (`index.tsx:25`, `painel-data.ts:58`,
  `anunciar.tsx:63`, `onboarding.tsx:25`), usar `getClaims()` também. O `painel-data.ts` usa `user.email`, que
  vem nas claims.
- Medir: TTFB logado de `/painel` e `/` (DevTools → Timing → "Waiting for server response"), com 5 amostras.

**1.5 Terceiros (A8).** Em `src/pages/_app.tsx`:
- AdSense: carregar só nas rotas onde se quer anúncio (ex.: não em `/painel`, `/mensagens`, `/admin`,
  `/anunciar`) e adiar para o ocioso (`requestIdleCallback`, regra `js-request-idle-callback`). É decisão de
  negócio, porque Auto Ads escolhe as posições sozinho.
- GA4: `strategy="lazyOnload"` nos dois `<Script>` (linhas 40-51). Perde-se uma parte pequena das sessões que
  saem antes do ocioso. `@next/third-parties` **exige aprovação** (dependência nova) e não é necessário.
- Medir: PageSpeed Insights da home de visitante (TBT e "Reduce the impact of third-party code") e
  número/tamanho dos requests de terceiros no DevTools.

**1.6 Imagens: lazy e dimensões (A9 em parte, A10).**
- `src/components/CardProduto.tsx:80,146`: `loading="lazy"`, `decoding="async"` e `width`/`height`
  (o card é `aspect-square`). Na home, os primeiros 4 cards do carrossel podem ficar `eager`.
- `src/components/HeroSection.tsx:217-229`: montar só a foto do slide ativo e a próxima (ou
  `loading="lazy"` nas de `idx > 0` com montagem atrasada até o 1º `setInterval`).
- `src/lib/storage.ts:44`: `cacheControl: "31536000"`. A URL já muda a cada upload (`?v=${Date.now()}`, linha 51).
  Vale para uploads novos; as fotos já enviadas continuam com 3600.
- Medir: bytes de imagem transferidos na `/listagem` logada (DevTools → Img) antes e depois; LCP da home.

**1.7 Cache de `public/` (A11).** Em `next.config.ts`, um bloco `headers()` para `/hero/:path*`, `/brand/:path*`
e `/faculdades/:path*` com `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` (ou nomes
versionados e `immutable`).
- Medir: `curl -D -` mostrando o novo header e HIT.

### Fase 2 — Estruturais (1–2 semanas)

**2.1 Resumo do usuário pelo SSR (A7).** Nas páginas que já calculam `getResumoUsuarioNavbar` (`/`, `/listagem`),
devolver `resumoNavbar` nas props. O `_app` passa `pageProps.resumoNavbar` para `<Navbar resumoInicial=… />`
e a Navbar só busca no cliente quando a prop não vem. Não é estado global, é prop.
- Medir: DevTools, 0 requisições da Navbar na carga de `/` e `/listagem`.

**2.2 Select enxuto para cards (A13).** Em `src/lib/queries.ts:456-460` e `:414-418`, tirar `descricao`,
`lojas.descricao` e `lojas.capa_url`. Ajustar `ProdutoListagem` em `src/types/index.ts` e o
`mapearProdutoListagem` (linha 376). Conferir antes se algum consumidor usa `loja_descricao` (hoje só os dados
de demonstração de `SecaoTrocas.tsx`).
- Medir: tamanho do `__NEXT_DATA__` da home logada (`document.getElementById('__NEXT_DATA__').textContent.length`).

**2.3 Fotos redimensionadas (A9).** Três caminhos:
- **(a) `next/image`** com `images.remotePatterns` para `ykefkzpbbemwvbpctacs.supabase.co/storage/v1/object/public/**`
  e `sizes` no card. Não é dependência nova, e a CSP já aceita `'self'` (as imagens saem de `/_next/image`).
  Custo: transformações contam na cota da Vercel (R3). Também resolve os 2 avisos do ESLint em `Navbar.tsx`.
- **(b) Redimensionar no upload** com `<canvas>` no navegador (sem dependência): gravar 1200 px WebP como
  `imagem.webp` e uma miniatura de 480 px (`{produtoId}/thumb.webp`). Exige liberar `thumb` em
  `url_imagem_valida`/política do bucket (migração nova) e reprocessar as fotos da carga fria.
- **(c)** Habilitar a transformação de imagem do Supabase (hoje 403, depende do plano).
- Recomendação: (b) se o plano da Vercel for Hobby; (a) se a cota couber.
- Medir: KB por card (meta abaixo de 40 KB), LCP de `/anuncio/[id]` e bytes de imagem da `/listagem`.

**2.4 Páginas públicas estáticas/ISR (A12).** `/ajuda` e `/cadastro` com `getStaticProps` +
`revalidate: 3600`, usando um cliente sem cookies (`createClient` de `@supabase/supabase-js` com a chave
publicável; `instituicoes` tem `SELECT` para `anon`). **Conflito**: o `CLAUDE.md` pede `getServerSideProps`
para dados iniciais. Registrar a exceção lá ("páginas públicas sem dado do usuário podem usar ISR").
Home de visitante: o middleware pode fazer `rewrite` para uma página estática quando não há cookie `sb-*`.
Ganho de cerca de 0,15 s de TTFB, mas ela já é rápida (0,33 s), então fica para depois de medir.
- Medir: `x-vercel-cache: HIT` e TTFB perto de 0,19 s nas duas rotas.

**2.5 Migrar `middleware.ts` → `proxy.ts` (A20).** `npx @next/codemod@canary middleware-to-proxy .`
(o codemod roda via npx; confirmar antes de usar). O proxy roda em Node.js, não em Edge: conferir latência e
custo na Vercel. Fazer depois de 1.1/1.2 para medir cada mudança separada.

**2.6 Seções do painel sob demanda (A18).** Em `PainelEstudante.tsx`, `next/dynamic` para `SecaoPerfil`,
`SecaoAnuncios` e `SecaoFavoritos`, carregando só a da `abaAtiva`.
- Medir: chunk de `/painel/*` (script de tamanhos usado na seção 2).

**2.7 supabase-js fora do caminho crítico (A19).** Opcional e de ganho limitado: na Navbar, importar
`@/lib/supabase` e `chat-realtime` com `import()` dentro do efeito, para tirar os 59 KB do `_app` nas rotas
que não usam `queries.ts` (`/termos`, `/privacidade`, `/esqueci-senha`, `/confirmar-email`). Nas demais rotas o
pacote continua vindo no chunk da página.
- Medir: First Load de `/termos` (hoje 175,7 KB, meta abaixo de 120 KB).

**2.8 Pequenos (A21, A22).** `const favoritosSet = useMemo(() => new Set(favoritos), [favoritos])` nas 5 listas;
`{ passive: true }` no `scroll` de `SeloVerificado.tsx:49`.

### Ordem sugerida e ganho esperado

| Ordem | Itens | Ganho esperado |
|---|---|---|
| 1 | 0.1 | −0,4 s TTFB por ida ao banco (se a região se confirmar) |
| 2 | 1.1, 1.2 | −1 ida ao Auth por requisição; imagens de `public/` em cache |
| 3 | 1.3, 1.4 | De ~6 para 0 requisições da Navbar por navegação; painel de 7 para 3 idas |
| 4 | 1.5, 1.6, 1.7 | −390 KB de terceiros no caminho crítico; MBs a menos de imagem na listagem |
| 5 | Fase 2 | Payload menor, imagens no tamanho certo, páginas públicas em cache |

---

## 5. Riscos

- **R1 — `getClaims()` no middleware.** Valida a assinatura e a validade do JWT, mas não consulta o servidor de
  Auth: sessão revogada ou usuário bloqueado continua "logado" no middleware até o token vencer (1 h por
  padrão). Os dados continuam protegidos, porque a RLS e as RPCs checam `status` no banco (`usuarios.status`,
  `contato_vendedor`, `admin_*`). Para `/admin` a RPC `is_admin` continua sendo a barreira. Teste: bloquear um
  aluno de teste e conferir que as páginas param de mostrar dados.
- **R2 — Região das funções.** Mudar para `gru1` piora a latência se algum serviço chamado pelo servidor
  estiver nos EUA (Vettly em `src/lib/moderacao.ts`, HIBP). Medir `/api/perguntas` depois da troca.
- **R3 — `next/image` na Vercel.** A otimização de imagem tem cota por plano e cobra excedente.
  `remotePatterns` amplo demais permite usar o otimizador como proxy: restringir ao caminho
  `/storage/v1/object/public/**` do projeto.
- **R4 — Matcher mais estreito.** Rota nova que precise de proteção e caia no padrão excluído (ex.: um `.txt`
  dinâmico) ficaria sem middleware. Manter a lista curta e explícita.
- **R5 — ISR em `/ajuda` e `/cadastro`.** Instituição nova aparece com até 1 h de atraso (ou usar `res.revalidate`
  numa rota de admin). Exige as variáveis `NEXT_PUBLIC_SUPABASE_*` no ambiente de build, o que o `CLAUDE.md` já
  prevê.
- **R6 — Navbar.** Tirar `router` das dependências não pode quebrar o redirecionamento ao `/onboarding` nem o
  logout. Testar troca de conta e sessão vencida.
- **R7 — AdSense/GA tardios.** `lazyOnload` reduz um pouco as sessões contadas; restringir o AdSense por rota
  reduz a receita potencial. São decisões do produto.
- **R8 — `cacheControl` longo no Storage.** Só é seguro porque a URL gravada muda a cada upload. Se alguém
  gravar a URL sem `?v=`, a troca de foto demora a aparecer.

---

## 6. O que ficou fora e por quê

- **Lighthouse/Web Vitals reais (LCP, INP, CLS):** não rodei Lighthouse (exigiria baixar o pacote) nem medi
  páginas logadas, porque o pedido proíbe login em produção. Os números de requisições logadas da Navbar
  (A6) vêm da leitura do código e do runtime do Next (`router.js:152`), não de captura de rede.
  `@vercel/speed-insights` daria esses dados de campo, mas **exige aprovação** (dependência nova).
- **Região do Supabase:** inferida pelo prefixo IPv6 do host do banco; não confirmei no painel.
- **Tamanho e `cacheControl` de todas as fotos do Storage:** a consulta agregada a `storage.objects` pelo MCP
  foi bloqueada pela permissão. Usei 4 amostras públicas por `curl`.
- **Índices e planos de consulta** (ex.: `ilike '%q%'` em `produtos.nome`, `queries.ts:465`; joins
  `lojas!inner(usuarios!inner…)`): é trabalho de banco, para a skill `supabase-postgres-best-practices`.
- **Realtime:** o desenho atual (canal único por usuário, broadcast privado, debounce) está adequado. A abertura
  do WebSocket em toda página logada é parte do recurso (contador da Navbar). O limite de conexões simultâneas
  do plano do Supabase deve ser acompanhado, mas não é gargalo de performance hoje.
- **`rendering-content-visibility` / virtualização:** listas são paginadas (40) ou curtas; não compensa.
- **SWR, React Query ou gerenciador de estado:** o `CLAUDE.md` proíbe estado global e dependência nova sem
  aprovação; as correções de deduplicação acima usam props e `useRef`.
- **Remover `'unsafe-inline'` da CSP / nonces:** é segurança, não performance (e nonce obriga SSR em tudo).
