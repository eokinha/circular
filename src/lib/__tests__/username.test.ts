import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarUsername, problemaUsername, usernamePadrao } from "../username.ts";

test("normalizarUsername: tira @ e espaços e deixa minúsculo", () => {
  assert.equal(normalizarUsername("  @Bia.Doces "), "bia.doces");
});

test("problemaUsername: aceita formatos válidos", () => {
  for (const u of ["bia.doces", "joao_silva", "ana-costa", "lu2", "Bia_Doces", "@livros.da.ana"]) {
    assert.equal(problemaUsername(u), null, u);
  }
});

test("problemaUsername: recusa tamanho, símbolos, só número, padrão do cadastro e termos reservados", () => {
  assert.match(problemaUsername("ab")!, /pelo menos 3/);
  assert.match(problemaUsername("a".repeat(31))!, /até 30/);
  assert.match(problemaUsername("joão")!, /sem acento/);
  assert.match(problemaUsername(".bia")!, /sem começar/);
  assert.match(problemaUsername("bia.")!, /sem começar/);
  assert.match(problemaUsername("bia..doces")!, /repetir/);
  assert.match(problemaUsername("bia doces")!, /sem acento/);
  assert.match(problemaUsername("12345")!, /uma letra/);
  assert.match(problemaUsername("aluno-42")!, /reservado aos perfis novos/);
  assert.match(problemaUsername("circular.oficial")!, /reservado à equipe/);
  assert.match(problemaUsername("superadmin")!, /reservado à equipe/);
});

test("usernamePadrao: identifica o endereço criado no cadastro", () => {
  assert.equal(usernamePadrao("aluno-12"), true);
  assert.equal(usernamePadrao(null), true);
  assert.equal(usernamePadrao("bia.doces"), false);
});
