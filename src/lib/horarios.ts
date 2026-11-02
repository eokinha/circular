// Dias e horários em que o aluno está no campus para combinar entregas (lojas.horarios, migração 28).
// Espelho da regra do banco (horarios_validos): até 14 faixas, dia 0 (domingo) a 6 (sábado),
// "HH:MM" com início antes do fim e sem faixas sobrepostas no mesmo dia. Mudar os dois juntos.
import type { HorarioDisponivel } from "@/types";

export const MAX_FAIXAS_HORARIO = 14;
export const MAX_FAIXAS_POR_DIA = 2;

// Ordem de exibição: segunda a domingo
export const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0] as const;
export const NOME_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
const SIGLA_DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

// Segunda primeiro; no mesmo dia, pela hora de início
export function ordenarHorarios(lista: HorarioDisponivel[]): HorarioDisponivel[] {
  const posicao = (dia: number) => ORDEM_DIAS.indexOf(dia as (typeof ORDEM_DIAS)[number]);
  return [...lista].sort((a, b) => posicao(a.dia) - posicao(b.dia) || a.inicio.localeCompare(b.inicio));
}

// Mensagem do primeiro problema, ou null se a lista pode ser gravada
export function problemaHorarios(lista: HorarioDisponivel[]): string | null {
  if (lista.length > MAX_FAIXAS_HORARIO) return `Use no máximo ${MAX_FAIXAS_HORARIO} horários.`;
  for (const h of lista) {
    if (!Number.isInteger(h.dia) || h.dia < 0 || h.dia > 6) return "Dia da semana inválido.";
    if (!HORA.test(h.inicio) || !HORA.test(h.fim)) return `Confira os horários de ${NOME_DIA[h.dia]}.`;
    if (h.inicio >= h.fim) return `Em ${NOME_DIA[h.dia]}, o horário de início precisa ser antes do fim.`;
  }
  const ordenada = ordenarHorarios(lista);
  for (let i = 1; i < ordenada.length; i++) {
    const anterior = ordenada[i - 1];
    const atual = ordenada[i];
    if (anterior.dia === atual.dia && atual.inicio < anterior.fim) {
      return `Em ${NOME_DIA[atual.dia]}, dois horários se sobrepõem.`;
    }
  }
  return null;
}

// Lê o que veio do banco: descarta itens fora do formato em vez de quebrar a página
export function lerHorarios(valor: unknown): HorarioDisponivel[] {
  if (!Array.isArray(valor)) return [];
  return ordenarHorarios(
    valor.filter(
      (h): h is HorarioDisponivel =>
        Boolean(h) &&
        typeof h === "object" &&
        Number.isInteger((h as HorarioDisponivel).dia) &&
        (h as HorarioDisponivel).dia >= 0 &&
        (h as HorarioDisponivel).dia <= 6 &&
        HORA.test(String((h as HorarioDisponivel).inicio)) &&
        HORA.test(String((h as HorarioDisponivel).fim))
    )
  );
}

function faixasDoDia(lista: HorarioDisponivel[], dia: number): string {
  return lista
    .filter((h) => h.dia === dia)
    .map((h) => `${h.inicio}–${h.fim}`)
    .join(", ");
}

// Agrupa dias seguidos com os mesmos horários: [{ dias: "Seg a Sex", faixas: "08:00–12:00" }, ...]
export function resumoHorarios(lista: HorarioDisponivel[]): { dias: string; faixas: string }[] {
  const ordenada = ordenarHorarios(lista);
  const grupos: { inicio: number; fim: number; faixas: string }[] = [];
  ORDEM_DIAS.forEach((dia, i) => {
    const faixas = faixasDoDia(ordenada, dia);
    if (!faixas) return;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.faixas === faixas && ultimo.fim === i - 1) {
      ultimo.fim = i;
    } else {
      grupos.push({ inicio: i, fim: i, faixas });
    }
  });
  return grupos.map((g) => {
    const primeiro = SIGLA_DIA[ORDEM_DIAS[g.inicio]];
    const ultimo = SIGLA_DIA[ORDEM_DIAS[g.fim]];
    const dias = g.inicio === g.fim ? primeiro : g.fim === g.inicio + 1 ? `${primeiro} e ${ultimo}` : `${primeiro} a ${ultimo}`;
    return { dias, faixas: g.faixas };
  });
}
