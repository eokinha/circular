import { test } from "node:test";
import assert from "node:assert/strict";
import { cookiesSessaoInvalidos, valorSessaoValido } from "../cookies-sessao.ts";

const CHAVE = "sb-ykefkzpbbemwvbpctacs-auth-token";
const sessao = JSON.stringify({ access_token: "a".repeat(40), refresh_token: "r", user: { nome: "João" } });
const codificado = "base64-" + Buffer.from(sessao, "utf8").toString("base64url");

test("valorSessaoValido: aceita base64 de JSON em UTF-8 e valor fora do formato base64-", () => {
  assert.equal(valorSessaoValido(codificado), true);
  assert.equal(valorSessaoValido(sessao), true);
  assert.equal(valorSessaoValido("abc"), true);
});

test("valorSessaoValido: recusa UTF-8 inválido, caractere fora do alfabeto e JSON quebrado", () => {
  assert.equal(valorSessaoValido("base64-xyz"), false);
  assert.equal(valorSessaoValido("base64-" + Buffer.from([0xff, 0xfe, 0x7b]).toString("base64url")), false);
  assert.equal(valorSessaoValido("base64-ab$c"), false);
  assert.equal(valorSessaoValido("base64-" + Buffer.from('{"a":').toString("base64url")), false);
});

test("cookiesSessaoInvalidos: cookie inteiro válido não é descartado", () => {
  assert.deepEqual(cookiesSessaoInvalidos([{ name: CHAVE, value: codificado }]), []);
});

test("cookiesSessaoInvalidos: pedaços válidos (.0, .1) não são descartados", () => {
  const meio = 30;
  const cookies = [
    { name: `${CHAVE}.0`, value: codificado.slice(0, meio) },
    { name: `${CHAVE}.1`, value: codificado.slice(meio) },
  ];
  assert.deepEqual(cookiesSessaoInvalidos(cookies), []);
});

test("cookiesSessaoInvalidos: base64-xyz é descartado, inteiro ou em pedaço", () => {
  assert.deepEqual(cookiesSessaoInvalidos([{ name: CHAVE, value: "base64-xyz" }]), [CHAVE]);
  assert.deepEqual(cookiesSessaoInvalidos([{ name: `${CHAVE}.0`, value: "base64-xyz" }]), [`${CHAVE}.0`]);
});

test("cookiesSessaoInvalidos: pedaço faltando ou de outra sessão descarta o grupo", () => {
  // Só o .0 de uma sessão longa: JSON truncado
  assert.deepEqual(cookiesSessaoInvalidos([{ name: `${CHAVE}.0`, value: codificado.slice(0, 40) }]), [`${CHAVE}.0`]);

  // .1 de outra sessão, com bytes que não são UTF-8
  const ruim = Buffer.from([0xc3, 0x28, 0xa0, 0xa1]).toString("base64url");
  const descartados = cookiesSessaoInvalidos([
    { name: `${CHAVE}.0`, value: codificado.slice(0, 40) },
    { name: `${CHAVE}.1`, value: ruim },
  ]);
  assert.deepEqual(descartados.sort(), [`${CHAVE}.0`, `${CHAVE}.1`]);

  // Buraco na sequência: .2 nunca seria lido
  const meio = 30;
  assert.deepEqual(
    cookiesSessaoInvalidos([
      { name: `${CHAVE}.0`, value: codificado.slice(0, meio) },
      { name: `${CHAVE}.1`, value: codificado.slice(meio) },
      { name: `${CHAVE}.3`, value: "base64-xyz" },
    ]),
    [`${CHAVE}.3`]
  );

  // Sem o .0, o @supabase/ssr ignora os pedaços: são apagados
  assert.deepEqual(cookiesSessaoInvalidos([{ name: `${CHAVE}.1`, value: codificado }]), [`${CHAVE}.1`]);
});

test("cookiesSessaoInvalidos: code verifier corrompido também é descartado", () => {
  assert.deepEqual(
    cookiesSessaoInvalidos([{ name: `${CHAVE}-code-verifier`, value: "base64-xyz" }]),
    [`${CHAVE}-code-verifier`]
  );
});

test("cookiesSessaoInvalidos: cookies não relacionados ficam intactos", () => {
  const cookies = [
    { name: "tema", value: "base64-xyz" },
    { name: "sb-outra-coisa", value: "base64-xyz" },
    { name: "_ga", value: "GA1.1.123" },
    { name: CHAVE, value: codificado },
  ];
  assert.deepEqual(cookiesSessaoInvalidos(cookies), []);
});
