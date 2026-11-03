// Paginação das telas de admin (migrações 34 e 35). Filtro, busca e página vão na URL para o
// getServerSideProps buscar só a página pedida.

// Espelho de v_por_pagina nas RPCs admin_*_pagina e admin_fila_chamados — mudar os dois juntos
export const POR_PAGINA_ADMIN = 20;

// Mesmo corte de padrao_busca_admin no banco
export const BUSCA_ADMIN_MAX = 100;

// ?pagina= da URL: inteiro >= 1; qualquer outra coisa vira 1
export function paginaDaQuery(valor: unknown): number {
  const n = typeof valor === "string" && /^\d{1,6}$/.test(valor) ? Number(valor) : 1;
  return n >= 1 ? n : 1;
}

// ?q= da URL: texto aparado e cortado; vazio vira ""
export function buscaDaQuery(valor: unknown): string {
  return typeof valor === "string" ? valor.trim().slice(0, BUSCA_ADMIN_MAX) : "";
}

export function totalDePaginas(total: number, porPagina = POR_PAGINA_ADMIN): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / porPagina));
}

// "21–40 de 45": primeiro e último item mostrados na página
export function faixaDaPagina(pagina: number, total: number, porPagina = POR_PAGINA_ADMIN): { inicio: number; fim: number } {
  if (total <= 0) return { inicio: 0, fim: 0 };
  return { inicio: (pagina - 1) * porPagina + 1, fim: Math.min(pagina * porPagina, total) };
}

// Monta "/caminho?a=1&b=2" sem os parâmetros vazios e sem pagina=1
export function caminhoComQuery(base: string, params: Record<string, string | number | null | undefined>): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === null || valor === undefined || valor === "") continue;
    if (chave === "pagina" && Number(valor) <= 1) continue;
    busca.set(chave, String(valor));
  }
  const texto = busca.toString();
  return texto ? `${base}?${texto}` : base;
}
