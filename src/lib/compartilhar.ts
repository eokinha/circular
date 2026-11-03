// Links compartilháveis do Circular (QR code, copiar link, WhatsApp):
//   loja    → /perfil/{slug}?c={código}&utm_source=qr
//   anúncio → /anuncio/{id}-{nome}?c={código}&utm_source=qr
// O código (lojas.codigo_compartilhamento, migração 20) deixa o login mostrar ao visitante de quem é
// a loja ou o anúncio sem permitir listar alunos/anúncios pelos ids. utm_* entra no Google Analytics.

export const PARAM_CODIGO = "c";

const SLUG = /^[A-Za-z0-9._-]{1,80}$/; // nome de usuário (migração 29) aceita ponto
const CODIGO = /^[0-9a-f]{12}$/;
const TAMANHO_MAXIMO_NOME = 60;

// "Calculadora HP 50g (usada)" → "calculadora-hp-50g-usada"
export function slugDoNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TAMANHO_MAXIMO_NOME)
    .replace(/-+$/g, "");
}

// Só o número identifica o anúncio; o nome é para o link ficar legível
export function caminhoAnuncio(id: number, nome: string): string {
  const slug = slugDoNome(nome);
  return slug ? `/anuncio/${id}-${slug}` : `/anuncio/${id}`;
}

// Parâmetro da rota /anuncio/[id] ("89-calculadora-hp" ou "89") → 89. O nome depois do id pode vir
// em qualquer forma ("89-Calculadora-HP", "89-café"): a página redireciona para o endereço certo.
const TAMANHO_MAXIMO_PARAM = 300;

export function idDoAnuncio(param: unknown): number | null {
  if (typeof param !== "string" || param.length > TAMANHO_MAXIMO_PARAM) return null;
  const m = param.match(/^(\d{1,9})(?:-[^/\\]*)?$/);
  if (!m) return null;
  const id = Number(m[1]);
  return id > 0 ? id : null;
}

function comCodigo(origem: string, caminho: string, codigo: string): string {
  const params = new URLSearchParams({ [PARAM_CODIGO]: codigo, utm_source: "qr", utm_medium: "qrcode" });
  return `${origem.replace(/\/+$/, "")}${caminho}?${params.toString()}`;
}

export function urlCompartilhamentoLoja(origem: string, slug: string, codigo: string): string {
  return comCodigo(origem, `/perfil/${encodeURIComponent(slug)}`, codigo);
}

export function urlCompartilhamentoAnuncio(origem: string, id: number, nome: string, codigo: string): string {
  return comCodigo(origem, caminhoAnuncio(id, nome), codigo);
}

export type DestinoCompartilhado =
  | { tipo: "loja"; slug: string; codigo: string }
  | { tipo: "anuncio"; id: number; codigo: string };

// "%E0" solto faz decodeURIComponent lançar erro; no middleware isso virava erro 500
function decodificar(trecho: string): string | null {
  try {
    return decodeURIComponent(trecho);
  } catch {
    return null;
  }
}

// Lê um caminho interno (o "next" do login) e diz se é link compartilhado de loja ou anúncio
export function destinoCompartilhado(destino: unknown): DestinoCompartilhado | null {
  if (typeof destino !== "string" || !/^\/(?![/\\])/.test(destino)) return null;
  let url: URL;
  try {
    url = new URL(destino, "https://circular.local");
  } catch {
    return null;
  }
  const codigo = url.searchParams.get(PARAM_CODIGO) ?? "";
  if (!CODIGO.test(codigo)) return null;

  const loja = url.pathname.match(/^\/perfil\/([^/]+)$/);
  if (loja) {
    const slug = decodificar(loja[1]);
    return slug !== null && SLUG.test(slug) ? { tipo: "loja", slug, codigo } : null;
  }
  const anuncio = url.pathname.match(/^\/anuncio\/([^/]+)$/);
  if (anuncio) {
    const id = idDoAnuncio(decodificar(anuncio[1]));
    return id ? { tipo: "anuncio", id, codigo } : null;
  }
  return null;
}
