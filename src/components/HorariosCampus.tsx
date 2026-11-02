import { Clock } from "lucide-react";
import { resumoHorarios } from "@/lib/horarios";
import type { HorarioDisponivel } from "@/types";

interface Props {
  horarios: HorarioDisponivel[];
}

// Quando o vendedor está no campus (perfil público e página do anúncio). Sem horários, não mostra nada.
export default function HorariosCampus({ horarios }: Props) {
  const resumo = resumoHorarios(horarios);
  if (resumo.length === 0) return null;
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-sm font-semibold text-tinta-suave inline-flex items-center gap-1.5 min-h-[28px]">
        <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
        No campus:
      </span>
      <ul className="flex flex-wrap gap-2">
        {resumo.map((r) => (
          <li key={r.dias} className="text-xs font-semibold px-2.5 py-1 bg-petroleo-50 text-petroleo rounded-pill">
            {r.dias} · {r.faixas}
          </li>
        ))}
      </ul>
    </div>
  );
}
