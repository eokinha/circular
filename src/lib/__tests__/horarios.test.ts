import { test } from "node:test";
import assert from "node:assert/strict";
import { lerHorarios, ordenarHorarios, problemaHorarios, resumoHorarios } from "../horarios.ts";

const h = (dia: number, inicio: string, fim: string) => ({ dia, inicio, fim });

test("ordenarHorarios: segunda primeiro, domingo por último, depois pela hora", () => {
  const r = ordenarHorarios([h(0, "10:00", "12:00"), h(1, "14:00", "16:00"), h(1, "08:00", "10:00")]);
  assert.deepEqual(r.map((x) => `${x.dia} ${x.inicio}`), ["1 08:00", "1 14:00", "0 10:00"]);
});

test("problemaHorarios: aceita lista vazia e faixas válidas", () => {
  assert.equal(problemaHorarios([]), null);
  assert.equal(problemaHorarios([h(1, "08:00", "12:00"), h(1, "14:00", "18:00")]), null);
  assert.equal(problemaHorarios([h(1, "08:00", "12:00"), h(1, "12:00", "13:00")]), null); // encostar pode
});

test("problemaHorarios: recusa fim antes do início, hora inválida, sobreposição e excesso", () => {
  assert.match(problemaHorarios([h(2, "12:00", "08:00")])!, /Terça.*antes do fim/);
  assert.match(problemaHorarios([h(2, "12:00", "12:00")])!, /antes do fim/);
  assert.match(problemaHorarios([h(3, "8:00", "12:00")])!, /Confira os horários de Quarta/);
  assert.match(problemaHorarios([h(3, "24:00", "23:00")])!, /Confira/);
  assert.match(problemaHorarios([h(7, "08:00", "09:00")])!, /Dia da semana/);
  assert.match(problemaHorarios([h(4, "08:00", "12:00"), h(4, "11:00", "13:00")])!, /Quinta.*sobrepõem/);
  assert.match(problemaHorarios(Array.from({ length: 15 }, (_, i) => h(i % 7, "08:00", "09:00")))!, /no máximo 14/);
});

test("lerHorarios: ignora formato errado vindo do banco", () => {
  assert.deepEqual(lerHorarios(null), []);
  assert.deepEqual(lerHorarios([h(1, "08:00", "12:00"), { dia: "1" }, h(9, "08:00", "09:00"), 3]), [h(1, "08:00", "12:00")]);
});

test("resumoHorarios: agrupa dias seguidos com os mesmos horários", () => {
  const semana = [1, 2, 3, 4, 5].map((d) => h(d, "08:00", "12:00"));
  assert.deepEqual(resumoHorarios(semana), [{ dias: "Seg a Sex", faixas: "08:00–12:00" }]);
  assert.deepEqual(resumoHorarios([h(1, "08:00", "12:00"), h(2, "08:00", "12:00"), h(4, "14:00", "16:00")]), [
    { dias: "Seg e Ter", faixas: "08:00–12:00" },
    { dias: "Qui", faixas: "14:00–16:00" },
  ]);
  assert.deepEqual(resumoHorarios([h(6, "09:00", "11:00"), h(0, "09:00", "11:00")]), [{ dias: "Sáb e Dom", faixas: "09:00–11:00" }]);
  assert.deepEqual(resumoHorarios([h(1, "14:00", "16:00"), h(1, "08:00", "10:00")]), [
    { dias: "Seg", faixas: "08:00–10:00, 14:00–16:00" },
  ]);
  assert.deepEqual(resumoHorarios([]), []);
});
