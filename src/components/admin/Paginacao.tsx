import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { faixaDaPagina, totalDePaginas } from "@/lib/paginacao";

interface Props {
  pagina: number;
  total: number;
  porPagina: number;
  hrefPagina: (pagina: number) => string;
  rotulo?: string; // aria-label da navegação
}

const BOTAO =
  "inline-flex items-center gap-1 px-3 min-h-[44px] rounded-controle border border-borda-controle bg-superficie text-sm font-semibold text-tinta hover:border-petroleo transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";

// Anterior / Próxima das listas do admin (some quando tudo cabe numa página)
export default function Paginacao({ pagina, total, porPagina, hrefPagina, rotulo = "Páginas" }: Props) {
  if (total <= porPagina) return null;
  const ultima = totalDePaginas(total, porPagina);
  const { inicio, fim } = faixaDaPagina(pagina, total, porPagina);

  return (
    <nav aria-label={rotulo} className="flex items-center justify-between gap-3 mt-4 text-sm">
      {pagina > 1 ? (
        <Link href={hrefPagina(pagina - 1)} className={BOTAO}>
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-tinta-suave text-center">
        {inicio}–{fim} de {total} · página {pagina} de {ultima}
      </span>
      {pagina < ultima ? (
        <Link href={hrefPagina(pagina + 1)} className={BOTAO}>
          Próxima
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
