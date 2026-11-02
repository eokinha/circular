import { Plus, X } from "lucide-react";
import { MAX_FAIXAS_POR_DIA, NOME_DIA, ORDEM_DIAS, ordenarHorarios } from "@/lib/horarios";
import type { HorarioDisponivel } from "@/types";

interface Props {
  valor: HorarioDisponivel[];
  onChange: (horarios: HorarioDisponivel[]) => void;
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";
const CAMPO_HORA = `min-h-[44px] px-2 rounded-controle border border-borda-controle bg-superficie text-sm text-tinta ${FOCO}`;
// Faixa sugerida ao ligar um dia e ao adicionar a segunda faixa
const PADRAO = [
  { inicio: "08:00", fim: "12:00" },
  { inicio: "14:00", fim: "18:00" },
];

// Editor de dias e horários no campus (Meus dados): cada dia liga/desliga e tem até 2 faixas.
// A validação (início antes do fim, sem sobreposição) é feita ao salvar, com problemaHorarios.
export default function EditorHorarios({ valor, onChange }: Props) {
  function faixasDo(dia: number) {
    return valor.filter((h) => h.dia === dia);
  }

  function trocarDia(dia: number, faixas: { inicio: string; fim: string }[]) {
    onChange(ordenarHorarios([...valor.filter((h) => h.dia !== dia), ...faixas.map((f) => ({ dia, ...f }))]));
  }

  return (
    <ul className="flex flex-col divide-y divide-borda border border-borda rounded-card bg-superficie">
      {ORDEM_DIAS.map((dia) => {
        const faixas = faixasDo(dia);
        const ligado = faixas.length > 0;
        return (
          <li key={dia} className="px-3 py-2 flex flex-col sm:flex-row sm:items-start gap-2">
            <label className="min-h-[44px] sm:w-36 shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-tinta cursor-pointer">
              <input
                type="checkbox"
                checked={ligado}
                onChange={(e) => trocarDia(dia, e.target.checked ? [PADRAO[0]] : [])}
                className="w-5 h-5 accent-petroleo"
              />
              {NOME_DIA[dia]}
            </label>

            {ligado ? (
              <div className="flex flex-col gap-2 flex-1">
                {faixas.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={f.inicio}
                      aria-label={`${NOME_DIA[dia]}: começa às`}
                      onChange={(e) => trocarDia(dia, faixas.map((x, j) => (j === i ? { inicio: e.target.value, fim: x.fim } : x)))}
                      className={CAMPO_HORA}
                    />
                    <span className="text-sm text-tinta-suave">até</span>
                    <input
                      type="time"
                      value={f.fim}
                      aria-label={`${NOME_DIA[dia]}: termina às`}
                      onChange={(e) => trocarDia(dia, faixas.map((x, j) => (j === i ? { inicio: x.inicio, fim: e.target.value } : x)))}
                      className={CAMPO_HORA}
                    />
                    {faixas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => trocarDia(dia, faixas.filter((_, j) => j !== i))}
                        aria-label={`Remover horário de ${NOME_DIA[dia]}`}
                        className={`w-11 h-11 inline-flex items-center justify-center rounded-controle text-tinta-suave hover:text-perigo ${FOCO}`}
                      >
                        <X size={18} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                {faixas.length < MAX_FAIXAS_POR_DIA && (
                  <button
                    type="button"
                    onClick={() => trocarDia(dia, [...faixas, PADRAO[1]])}
                    className={`self-start min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-petroleo hover:underline rounded-controle ${FOCO}`}
                  >
                    <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                    Outro horário
                  </button>
                )}
              </div>
            ) : (
              <span className="min-h-[44px] inline-flex items-center text-sm text-tinta-sutil">Fora do campus</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
