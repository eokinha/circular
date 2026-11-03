import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIAS_CHAMADO,
  POR_PAGINA_CHAMADOS,
  caminhoFilaAdmin,
  paginaDaQuery,
  totalDePaginas,
  EMAIL_SUPORTE,
  caminhoChamado,
  categoriaValida,
  emailAberturaAluno,
  emailAberturaEquipe,
  emailResolucaoAluno,
  emailRespostaAluno,
  escaparHtml,
  linkMailtoSuporte,
  problemaNovoChamado,
  rotuloCategoria,
  statusValido,
} from "../suporte.ts";

const ID = "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f";
const BASE = { protocolo: "CIR-2026-00042", assunto: "Conta suspensa", categoria: "conta", chamadoId: ID };

test("categorias espelham o CHECK de chamados (migração 31)", () => {
  assert.deepEqual(
    CATEGORIAS_CHAMADO.map((c) => c.valor),
    ["conta", "acesso", "anuncio", "negociacao", "privacidade", "outro"]
  );
  assert.equal(categoriaValida("conta"), true);
  assert.equal(categoriaValida("hack"), false);
  assert.equal(rotuloCategoria("desconhecida"), "Outro assunto");
});

test("statusValido aceita só os três status", () => {
  for (const s of ["aberto", "em_atendimento", "resolvido"]) assert.equal(statusValido(s), true);
  assert.equal(statusValido("fechado"), false);
  assert.equal(statusValido(undefined), false);
  assert.equal(statusValido("toString"), false);
});

test("problemaNovoChamado segue os limites de abrir_chamado", () => {
  assert.equal(problemaNovoChamado("conta", "Conta suspensa", "Fui suspenso sem motivo claro."), null);
  assert.match(problemaNovoChamado("", "Conta suspensa", "Fui suspenso sem motivo.") ?? "", /assunto/);
  assert.match(problemaNovoChamado("conta", "Oi", "Fui suspenso sem motivo.") ?? "", /título/);
  assert.match(problemaNovoChamado("conta", "a".repeat(121), "Fui suspenso sem motivo.") ?? "", /título/);
  assert.match(problemaNovoChamado("conta", "Conta suspensa", "curto") ?? "", /10 a 2000/);
  assert.match(problemaNovoChamado("conta", "Conta suspensa", "x".repeat(2001)) ?? "", /10 a 2000/);
  // espaços nas pontas não contam
  assert.match(problemaNovoChamado("conta", "   Oi   ", "Fui suspenso sem motivo.") ?? "", /título/);
});

test("mailto e caminhos do chamado", () => {
  assert.equal(EMAIL_SUPORTE, "suporte@eokinha.com.br");
  assert.equal(linkMailtoSuporte(), "mailto:suporte@eokinha.com.br");
  assert.equal(linkMailtoSuporte("Não consigo entrar"), "mailto:suporte@eokinha.com.br?subject=N%C3%A3o%20consigo%20entrar");
  assert.equal(caminhoChamado(ID), `/painel/suporte?chamado=${ID}`);
  assert.equal(caminhoChamado(ID, true), `/admin/suporte?chamado=${ID}`);
});

test("escaparHtml neutraliza tags e aspas", () => {
  assert.equal(escaparHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
});

test("e-mail de abertura traz protocolo e link do chamado", () => {
  const e = emailAberturaAluno({ ...BASE, nome: "Bia Souza" }, "https://exemplo.test");
  assert.match(e.assunto, /CIR-2026-00042/);
  assert.match(e.html, /Olá, Bia!/);
  assert.ok(e.texto.includes(`https://exemplo.test/painel/suporte?chamado=${ID}`));
  assert.match(e.html, /Conta suspensa ou bloqueada/);
});

test("texto do aluno e da equipe sai escapado no HTML", () => {
  const equipe = emailAberturaEquipe({ ...BASE, assunto: "<b>x</b>", descricao: "<img src=x onerror=1>\nlinha 2", aluno: "Aluno <teste>" });
  assert.doesNotMatch(equipe.html, /<img src=x/);
  assert.doesNotMatch(equipe.html, /<b>x<\/b>/);
  assert.match(equipe.html, /&lt;img src=x onerror=1&gt;<br>linha 2/);
  assert.match(equipe.html, /\/admin\/suporte\?chamado=/);
  const resposta = emailRespostaAluno({ ...BASE, resposta: "<a href=//mal>clique</a>" });
  assert.doesNotMatch(resposta.html, /<a href=\/\/mal>/);
  assert.match(resposta.texto, /<a href=\/\/mal>clique<\/a>/); // texto puro mantém o original
});

test("e-mail de resolução traz período e última resposta (opcional)", () => {
  const com = emailResolucaoAluno({
    ...BASE,
    abertoEm: "2026-11-01T12:00:00Z",
    resolvidoEm: "2026-11-02T15:30:00Z",
    ultimaResposta: "Revisamos e reativamos sua conta.",
  });
  assert.match(com.assunto, /resolvido/);
  assert.match(com.texto, /01\/11\/2026/);
  assert.match(com.texto, /Revisamos e reativamos/);
  const sem = emailResolucaoAluno({ ...BASE, abertoEm: "2026-11-01T12:00:00Z", resolvidoEm: "2026-11-02T15:30:00Z" });
  assert.doesNotMatch(sem.texto, /Última resposta/);
  assert.match(sem.html, /Olá!/);
});

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

test("totalDePaginas usa 20 por página e nunca menos de 1", () => {
  assert.equal(POR_PAGINA_CHAMADOS, 20);
  assert.equal(totalDePaginas(0), 1);
  assert.equal(totalDePaginas(20), 1);
  assert.equal(totalDePaginas(21), 2);
  assert.equal(totalDePaginas(45), 3);
});

test("caminhoFilaAdmin mantém filtro, página e chamado", () => {
  assert.equal(caminhoFilaAdmin({ status: "aberto" }), "/admin/suporte?status=aberto");
  assert.equal(caminhoFilaAdmin({ status: "todos", pagina: 1 }), "/admin/suporte?status=todos");
  assert.equal(
    caminhoFilaAdmin({ status: "resolvido", pagina: 3, chamado: "abc" }),
    "/admin/suporte?status=resolvido&pagina=3&chamado=abc"
  );
});
