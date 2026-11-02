# Relatório Lighthouse — Circular

Data: 02/11/2026 · Produção: https://circular.eokinha.com.br · Lighthouse 12 (`npx lighthouse@12`, Edge headless, local)
Perfis: **celular** (padrão do Lighthouse: Moto G simulado, 4G lento, CPU 4×) e **desktop** (`--preset=desktop`).
Só páginas públicas: o catálogo, o painel e o chat exigem login e não foram medidos.

Complementa `docs/plano-otimizacao-next.md` (performance em detalhe) e `docs/relatorio-skills.md` (acessibilidade e segurança).

## Notas atuais

| Página | Perf. | Acessib. | Boas práticas | SEO | FCP | LCP | TBT | CLS | Speed Index |
|---|---|---|---|---|---|---|---|---|---|
| Home — celular | **90** | 95 | **57** | 82 | 1,6 s | **3,4 s** | 120 ms | 0 | 3,1 s |
| Home — desktop | 99 | 95 | **56** | 82 | 0,5 s | 0,8 s | 0 ms | 0 | 0,9 s |
| Login — celular | 97 | 91 | **57** | 82 | 1,6 s | 1,7 s | 170 ms | 0 | 2,3 s |
| Login — desktop | 100 | 91 | **56** | 82 | 0,5 s | 0,5 s | 0 ms | 0 | 0,8 s |
| Cadastro — celular | 94 | 91 | **57** | 82 | 1,6 s | 1,9 s | 250 ms | 0 | 3,0 s |
| Cadastro — desktop | 100 | 91 | **56** | 82 | 0,5 s | 0,5 s | 0 ms | 0 | 1,0 s |
| Ajuda — celular | 96 | 95 | **57** | 91 | 1,6 s | 1,9 s | 180 ms | 0 | 2,8 s |
| Ajuda — desktop | 100 | 95 | **56** | 91 | 0,5 s | 0,5 s | 0 ms | 0 | 1,1 s |
| Termos — celular | 98 | 95 | 75 | 82 | 1,6 s | 1,6 s | 140 ms | 0 | 2,2 s |
| Termos — desktop | 100 | 95 | 74 | 82 | 0,5 s | 0,5 s | 0 ms | 0 | 0,8 s |

**Leitura:** performance já é boa (CLS zero em tudo); o que derruba o site é **Boas práticas (56–75)**, seguida de **SEO (82–91)**
e **Acessibilidade (91–95)**. Os três têm correções baratas. Em performance, o ponto fraco é a **home no celular** (LCP 3,4 s).

Uma rodada só por página, numa máquina local: performance varia alguns pontos entre execuções. Não há dados de campo (CrUX)
para o domínio, porque o tráfego ainda é pequeno.

## O que derruba cada nota

### Boas práticas (56–75) — quase tudo vem de fora do código

| Auditoria | Causa encontrada | Páginas |
|---|---|---|
| Erros no console | (1) `favicon.ico` dá **404** (não existe favicon em `public/` nem `<link rel="icon">`). (2) **Cloudflare Web Analytics** injeta `static.cloudflareinsights.com/beacon.min.js`, que a CSP bloqueia | todas |
| Problemas no painel Issues | o mesmo bloqueio da CSP + cookie do AdSense | todas |
| APIs obsoletas (3) | `FencedFrame`, `Fledge`, `StorageType.persistent` vindos de `/cdn-cgi/challenge-platform/…/main.js` — script de **detecção de bots do Cloudflare** | todas, menos Termos |
| Cookies de terceiros | `test_cookie` de `googleads.g.doubleclick.net` (**AdSense**) | todas |

O site passa pela Cloudflare (`Server: cloudflare`, `CF-RAY`) antes da Vercel, e a Cloudflare injeta scripts no HTML.

### SEO (82–91)

| Auditoria | Causa | Páginas |
|---|---|---|
| Sem meta description | só `/ajuda` tem | home, login, cadastro, termos |
| `robots.txt` inválido | o arquivo é o **robots gerenciado da Cloudflare**; a linha 31 `Content-Signal: search=yes,ai-train=no,use=reference` é diretiva que o Lighthouse não conhece | todas |

### Acessibilidade (91–95)

| Auditoria | Causa | Páginas |
|---|---|---|
| `<html>` sem `lang` | não existe `src/pages/_document.tsx` | todas |
| Campos sem rótulo associado | `<label>` sem `htmlFor` em `login.tsx:226,240` e `cadastro.tsx:193,204,257` | login, cadastro |

### Performance

| Auditoria | Detalhe | Onde |
|---|---|---|
| **LCP 3,4 s na home (celular)** | O elemento é a 1ª foto do hero. Fases: TTFB 0,66 s · **espera para começar a baixar 1,37 s** · **download 1,16 s** · render 0,17 s | `src/components/HeroSection.tsx:217-228` |
| Imagens maiores que o necessário | as 4 fotos do hero (WebP 1600 px, 373 KB juntas) baixam no celular; economia estimada **277 KB** | `public/hero/*.webp` |
| JavaScript não usado (~296 KB) | AdSense `show_ads_impl` 123 KB + `adsbygoogle.js` 30 KB, GA4 74 KB, chunk do app 50 KB (cliente Supabase) | `src/pages/_app.tsx` |
| Time to Interactive 6,7 s (celular) | JS de terceiros (GA4 + AdSense ≈ 390 KB transferidos) | todas |
| Resposta do servidor 610–710 ms | páginas com `getServerSideProps`: função da Vercel em `iad1` (EUA) consultando o Supabase em São Paulo | ajuda, cadastro (e login/home) |
| bfcache bloqueado | `Cache-Control: no-store` das páginas com `getServerSideProps` (Termos, que é estática, passa) | home, login, cadastro, ajuda |
| Recurso bloqueando renderização | `cdn-cgi/…/email-decode.min.js` (**ofuscação de e-mail da Cloudflare**, 472 ms), porque o `/ajuda` cita `nao-responda@eokinha.com.br` | ajuda |
| JS legado 14 KB | polyfills no chunk `0_57z87wy0ny6.js` | todas |

## Plano para maximizar

Ordem por ganho ÷ esforço. "Nota esperada" é estimativa a partir dos pesos do Lighthouse 12; confirmar re-rodando.

### Etapa 1 — Painel da Cloudflare (sem código, ~15 min)

| Ação | Onde | Efeito |
|---|---|---|
| Desligar **Web Analytics** automático (o site já tem GA4) — ou, se quiser mantê-lo, liberar `static.cloudflareinsights.com` no `script-src` e `cloudflareinsights.com` no `connect-src` da CSP (`next.config.ts`) | Analytics & Logs → Web Analytics | some o erro de CSP do console e do Issues |
| Desligar **Email Address Obfuscation** | Scrape Shield | tira o script que bloqueia a renderização do `/ajuda` (e para de reescrever o e-mail do FAQ) |
| Avaliar **JavaScript Detections / Bot Fight Mode** | Security → Bots | tira as 3 APIs obsoletas. Troca: perde detecção de bots por JS; o site já tem limites por RPC (anti-raspagem, denúncias, chat) |
| Desligar o **robots.txt gerenciado** e servir o próprio (etapa 2) | Security → Bots → "Manage your robots.txt" (ou AI Crawl Control) | `robots.txt` válido |

### Etapa 2 — Um PR pequeno de front-end (~meio dia) → Acessibilidade e SEO 100

1. `src/pages/_document.tsx` com `<Html lang="pt-BR">`, `<link rel="icon" href="/brand/circular-simbolo.svg">`, `favicon.ico` em `public/`,
   `apple-touch-icon` e `<meta name="theme-color">` (token `petroleo`). **Corrige `html-has-lang` e o 404 do favicon.**
2. `htmlFor` + `id` nos campos de login, cadastro, esqueci a senha e redefinir senha.
3. `meta description` (e `og:title`/`og:description`/`og:image`) na home, login, cadastro, termos e privacidade.
4. `public/robots.txt` próprio com `Sitemap:`, bloqueando os crawlers de IA por `User-agent` (GPTBot, CCBot, Google-Extended…)
   para manter a intenção do `ai-train=no`, e `sitemap.xml` com as páginas públicas (home, ajuda, termos, privacidade, cadastro, login).

**Nota esperada:** Acessibilidade **100** em todas; SEO **100** em todas.

### Etapa 3 — LCP da home no celular (~meio dia) → Performance ~97–100

1. Gerar versões menores das fotos do hero (ex.: 640 e 1024 px em WebP, ~25–50 KB) e usar `srcSet` + `sizes` no `<img>` de
   `HeroSection.tsx:219` — economia de ~277 KB no celular.
2. Baixar **só a 1ª foto** no carregamento; as outras entram com `loading="lazy"` ou só quando o slide for ficar visível.
3. `<link rel="preload" as="image" fetchpriority="high" imagesrcset=…>` da 1ª foto no `<Head>` da home, para o navegador
   começar o download junto com o HTML (ataca os 1,37 s de espera).
4. `transition-all` → `transition-[width,background-color]` em `HeroSection.tsx:277`.

**Nota esperada:** LCP da home no celular de 3,4 s para ~2 s.

### Etapa 4 — Terceiros e servidor → TTI, TBT e Boas práticas

| Ação | Onde | Efeito | Observação |
|---|---|---|---|
| Carregar o AdSense **depois do `load`/ocioso** e **só nas páginas com espaço de anúncio** (hoje não existe nenhum bloco no código; a home de visitante, login e cadastro podem ficar sem) | `src/pages/_app.tsx` | −150 KB de JS não usado; TTI e TBT menores; nessas páginas some o cookie de terceiros → Boas práticas pode chegar a **100** | Enquanto o AdSense carregar numa página, aquela página fica com Boas práticas ≤ ~81 (cookie de terceiros + Issues) |
| GA4 com `strategy="lazyOnload"` | `src/pages/_app.tsx` | menos JS no caminho crítico | pode perder parte das visitas muito curtas |
| Região das funções da Vercel para **`gru1`** (São Paulo, junto do Supabase) | Vercel → Settings → Functions | TTFB de ~0,7 s para ~0,2–0,3 s em todas as páginas com `getServerSideProps` | sem código; detalhado no plano de otimização (Fase 0) |
| Páginas públicas estáticas com revalidação (`/ajuda`, `/termos`, `/privacidade`; avaliar login e cadastro, que só leem a lista de faculdades) | páginas | TTFB de página estática e **bfcache liberado** | conflita com a regra "dados iniciais via `getServerSideProps`" do `CLAUDE.md`: precisa de exceção explícita para páginas públicas |
| Tirar o cliente Supabase do bundle das páginas públicas | ver plano (Fase 2) | −50 KB de JS não usado | estrutural |

## Metas depois das etapas

| Categoria | Hoje | Meta | Depende de |
|---|---|---|---|
| Acessibilidade | 91–95 | **100** | etapa 2 |
| SEO | 82–91 | **100** | etapas 1 e 2 |
| Boas práticas | 56–75 | **~81** com AdSense carregando · **100** nas páginas sem AdSense | etapas 1, 2 e AdSense da etapa 4 |
| Performance celular | 90–98 | **97–100** | etapa 3 e região/terceiros da etapa 4 |
| Performance desktop | 99–100 | 100 | — |

## Como repetir a medição

```bash
CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
npx --yes lighthouse@12 https://circular.eokinha.com.br/ --chrome-flags="--headless=new" \
  --output=html --output=json --output-path=./lighthouse/home-mobile --locale=pt-BR
# desktop: acrescentar --preset=desktop
```

O `npx` baixa o Lighthouse só no cache dele; não entra no `package.json`. Para dados mais próximos do usuário real, usar
https://pagespeed.web.dev (a API do PageSpeed sem chave está com cota zero) e, quando houver tráfego, o relatório de
Core Web Vitals do Search Console.

## O que não foi medido

- Páginas logadas (listagem, anúncio, perfil, painel, chat, admin).
- Variação entre execuções (uma rodada por página/perfil).
- Impacto real das mudanças da Cloudflare: os itens dela foram identificados pelo Lighthouse, mas a configuração do painel não foi conferida.
