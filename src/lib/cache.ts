// Cache de páginas públicas no Cloudflare (que fica na frente da Vercel em circular.eokinha.com.br).
//
// Cloudflare-CDN-Cache-Control só vale para o Cloudflare: ele não repassa o cabeçalho, e nem a Vercel nem o
// navegador o leem. Assim a página continua com getServerSideProps e só o Cloudflare guarda a cópia.
// Só se libera o cache para quem chega SEM cookie de sessão do Supabase; quem tem sessão segue com o padrão
// do Next (private, no-store). No painel do Cloudflare, uma regra também ignora o cache quando o cookie existe.

import type { GetServerSidePropsContext } from "next";

// Cookie de sessão do @supabase/ssr: sb-<ref>-auth-token, em pedaços (.0, .1) quando é grande.
// O code-verifier (sb-<ref>-auth-token-code-verifier) também conta: é melhor não cachear do que errar.
// Espelho: regra de bypass do Cloudflare (http.cookie contains "-auth-token") e o `missing` do next.config.ts
export const PADRAO_COOKIE_SESSAO = /^sb-.+-auth-token/;

// Páginas com getServerSideProps: 5 min no Cloudflare; depois serve a cópia enquanto busca a nova.
// O deploy limpa o cache (.github/workflows/limpar-cache-cloudflare.yml)
export const CACHE_CLOUDFLARE_PAGINA = "public, max-age=300, stale-while-revalidate=86400";

// Navegador: sempre confirma com o servidor, mas sem no-store (libera o "voltar" instantâneo, o bfcache)
export const CACHE_NAVEGADOR_PAGINA = "private, no-cache";

export function temCookieDeSessao(nomesCookies: Iterable<string>): boolean {
  for (const nome of nomesCookies) {
    if (PADRAO_COOKIE_SESSAO.test(nome)) return true;
  }
  return false;
}

// Cabeçalhos para a página pública; null quando há sessão (a resposta segue o padrão do Next)
export function cabecalhosCacheVisitante(nomesCookies: Iterable<string>): Record<string, string> | null {
  if (temCookieDeSessao(nomesCookies)) return null;
  return {
    "Cloudflare-CDN-Cache-Control": CACHE_CLOUDFLARE_PAGINA,
    "Cache-Control": CACHE_NAVEGADOR_PAGINA,
  };
}

// Chamar só em página pública, cujo HTML de visitante é o mesmo para todos (nunca com dado de aluno)
export function liberarCacheVisitante(ctx: Pick<GetServerSidePropsContext, "req" | "res">): void {
  const cabecalhos = cabecalhosCacheVisitante(Object.keys(ctx.req.cookies ?? {}));
  if (!cabecalhos) return;
  for (const [nome, valor] of Object.entries(cabecalhos)) ctx.res.setHeader(nome, valor);
}
