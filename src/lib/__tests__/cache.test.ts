import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_CLOUDFLARE_PAGINA,
  CACHE_NAVEGADOR_PAGINA,
  cabecalhosCacheVisitante,
  liberarCacheVisitante,
  temCookieDeSessao,
} from "../cache.ts";

const REF = "sb-ykefkzpbbemwvbpctacs";

test("temCookieDeSessao reconhece o cookie do Supabase inteiro, em pedaços e o code-verifier", () => {
  assert.equal(temCookieDeSessao([`${REF}-auth-token`]), true);
  assert.equal(temCookieDeSessao([`${REF}-auth-token.0`, `${REF}-auth-token.1`]), true);
  assert.equal(temCookieDeSessao([`${REF}-auth-token-code-verifier`]), true);
  assert.equal(temCookieDeSessao(["_ga", "__cf_bm", `${REF}-auth-token`]), true);
});

test("temCookieDeSessao ignora cookies que não são de sessão", () => {
  assert.equal(temCookieDeSessao([]), false);
  assert.equal(temCookieDeSessao(["_ga", "_ga_7HJT8QR82M", "__cf_bm", "cf_clearance"]), false);
  assert.equal(temCookieDeSessao(["auth-token", "sb-auth"]), false);
});

test("cabecalhosCacheVisitante libera o Cloudflare só sem sessão", () => {
  assert.deepEqual(cabecalhosCacheVisitante(["_ga"]), {
    "Cloudflare-CDN-Cache-Control": CACHE_CLOUDFLARE_PAGINA,
    "Cache-Control": CACHE_NAVEGADOR_PAGINA,
  });
  assert.equal(cabecalhosCacheVisitante([`${REF}-auth-token.0`]), null);
});

test("os cabeçalhos nunca deixam o navegador nem a Vercel guardarem como público", () => {
  assert.match(CACHE_NAVEGADOR_PAGINA, /^private\b/);
  assert.doesNotMatch(CACHE_NAVEGADOR_PAGINA, /s-maxage|public/);
  assert.match(CACHE_CLOUDFLARE_PAGINA, /^public, max-age=\d+/);
});

function contexto(cookies: Record<string, string>) {
  const gravados: Record<string, string> = {};
  const ctx = {
    req: { cookies },
    res: { setHeader: (nome: string, valor: string) => { gravados[nome] = valor; } },
  };
  return { ctx: ctx as unknown as Parameters<typeof liberarCacheVisitante>[0], gravados };
}

test("liberarCacheVisitante grava os cabeçalhos para visitante e nada para quem tem sessão", () => {
  const visitante = contexto({ _ga: "1" });
  liberarCacheVisitante(visitante.ctx);
  assert.equal(visitante.gravados["Cloudflare-CDN-Cache-Control"], CACHE_CLOUDFLARE_PAGINA);
  assert.equal(visitante.gravados["Cache-Control"], CACHE_NAVEGADOR_PAGINA);

  const logado = contexto({ [`${REF}-auth-token`]: "base64-..." });
  liberarCacheVisitante(logado.ctx);
  assert.deepEqual(logado.gravados, {});
});
