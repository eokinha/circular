// Cache das páginas públicas no navegador.
//
// O padrão do Next para getServerSideProps é "private, no-cache, no-store": o no-store impede o "voltar"
// instantâneo do navegador (bfcache). Para visitante SEM cookie de sessão do Supabase, a página pública sai
// com "private, no-cache": o navegador sempre confirma com o servidor e nenhum CDN guarda a cópia (private).
// Quem tem sessão segue com o padrão do Next.

import type { GetServerSidePropsContext } from "next";

// Cookie de sessão do @supabase/ssr: sb-<ref>-auth-token, em pedaços (.0, .1) quando é grande.
// O code-verifier (sb-<ref>-auth-token-code-verifier) também conta: na dúvida, segue o padrão do Next
export const PADRAO_COOKIE_SESSAO = /^sb-.+-auth-token/;

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
  return { "Cache-Control": CACHE_NAVEGADOR_PAGINA };
}

// Chamar só em página pública, cujo HTML de visitante é o mesmo para todos (nunca com dado de aluno),
// e depois das consultas (página de erro segue o padrão do Next)
export function liberarCacheVisitante(ctx: Pick<GetServerSidePropsContext, "req" | "res">): void {
  const cabecalhos = cabecalhosCacheVisitante(Object.keys(ctx.req.cookies ?? {}));
  if (!cabecalhos) return;
  for (const [nome, valor] of Object.entries(cabecalhos)) ctx.res.setHeader(nome, valor);
}
