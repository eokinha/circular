import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUSCA_ADMIN_MAX,
  POR_PAGINA_ADMIN,
  buscaDaQuery,
  caminhoComQuery,
  faixaDaPagina,
  paginaDaQuery,
  totalDePaginas,
} from "../paginacao.ts";

test("paginaDaQuery aceita só inteiro positivo", () => {
  assert.equal(paginaDaQuery("3"), 3);
  assert.equal(paginaDaQuery(undefined), 1);
  assert.equal(paginaDaQuery("0"), 1);
  assert.equal(paginaDaQuery("-2"), 1);
  assert.equal(paginaDaQuery("2.5"), 1);
  assert.equal(paginaDaQuery("abc"), 1);
  assert.equal(paginaDaQuery(["2"]), 1);
  assert.equal(paginaDaQuery("9999999"), 1);
});

test("buscaDaQuery apara, corta e ignora o que não é texto", () => {
  assert.equal(buscaDaQuery("  ana  "), "ana");
  assert.equal(buscaDaQuery(undefined), "");
  assert.equal(buscaDaQuery(["ana"]), "");
  assert.equal(buscaDaQuery("x".repeat(300)).length, BUSCA_ADMIN_MAX);
});

test("totalDePaginas usa 20 por página e nunca menos de 1", () => {
  assert.equal(POR_PAGINA_ADMIN, 20);
  assert.equal(totalDePaginas(0), 1);
  assert.equal(totalDePaginas(20), 1);
  assert.equal(totalDePaginas(21), 2);
  assert.equal(totalDePaginas(180), 9);
});

test("faixaDaPagina mostra primeiro e último item da página", () => {
  assert.deepEqual(faixaDaPagina(1, 0), { inicio: 0, fim: 0 });
  assert.deepEqual(faixaDaPagina(1, 45), { inicio: 1, fim: 20 });
  assert.deepEqual(faixaDaPagina(3, 45), { inicio: 41, fim: 45 });
});

test("caminhoComQuery omite vazios e a página 1", () => {
  assert.equal(caminhoComQuery("/admin/contas", {}), "/admin/contas");
  assert.equal(caminhoComQuery("/admin/contas", { filtro: "todas", q: "", pagina: 1 }), "/admin/contas?filtro=todas");
  assert.equal(caminhoComQuery("/admin/contas", { q: "ana souza", pagina: 2 }), "/admin/contas?q=ana+souza&pagina=2");
  assert.equal(caminhoComQuery("/admin/lojas", { q: "a&b=c" }), "/admin/lojas?q=a%26b%3Dc");
});
