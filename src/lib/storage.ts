import { supabase } from "@/lib/supabase";

const TAMANHO_MAXIMO_BYTES = 3 * 1024 * 1024;
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

export type TipoImagemLoja = "avatar" | "capa";

function extensaoPorMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function validarArquivo(file: File): void {
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error(
      "Formato não suportado. Envie uma imagem JPG, PNG ou WebP."
    );
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    throw new Error(
      `Imagem muito grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limite de 3 MB.`
    );
  }
}

async function uploadEPegarUrlPublica(
  bucket: "lojas" | "produtos",
  caminho: string,
  file: File
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(caminho, file, {
      upsert: true,
      contentType: file.type,
      // URL muda a cada upload (?v=), então a foto pode ficar 1 ano no CDN do Supabase e no navegador
      cacheControl: "31536000",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(caminho);
  // adiciona timestamp para forçar bypass de cache no front após upsert
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadImagemLoja(
  lojaId: number,
  tipo: TipoImagemLoja,
  file: File
): Promise<string> {
  validarArquivo(file);

  const ext = extensaoPorMime(file.type);
  const caminho = `${lojaId}/${tipo}.${ext}`;

  const url = await uploadEPegarUrlPublica("lojas", caminho, file);

  const coluna = tipo === "avatar" ? "avatar_url" : "capa_url";
  const { error: dbError } = await supabase
    .from("lojas")
    .update({ [coluna]: url })
    .eq("id", lojaId);

  if (dbError) throw dbError;

  return url;
}

export async function uploadImagemProduto(
  produtoId: number,
  file: File
): Promise<string> {
  validarArquivo(file);

  const ext = extensaoPorMime(file.type);
  const caminho = `${produtoId}/imagem.${ext}`;

  const url = await uploadEPegarUrlPublica("produtos", caminho, file);

  const { error: dbError } = await supabase
    .from("produtos")
    .update({ imagem_url: url })
    .eq("id", produtoId);

  if (dbError) throw dbError;

  return url;
}

async function removerPasta(bucket: "lojas" | "produtos", pasta: string): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).list(pasta);
  if (error) throw error;
  if (!data || data.length === 0) return;

  const { error: removeError } = await supabase.storage
    .from(bucket)
    .remove(data.map((arquivo) => `${pasta}/${arquivo.name}`));
  if (removeError) throw removeError;
}

// Chamar antes de apagar o produto: a política do Storage exige que o produto exista
export async function removerImagensProduto(produtoId: number): Promise<void> {
  await removerPasta("produtos", String(produtoId));
}

export async function removerImagensDaConta(lojaId: number, produtoIds: number[]): Promise<void> {
  await Promise.all([
    removerPasta("lojas", String(lojaId)),
    ...produtoIds.map((id) => removerPasta("produtos", String(id))),
  ]);
}
