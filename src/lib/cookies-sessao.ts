/**
 * Cookies de sessão do Supabase corrompidos (ex.: pedaços .0/.1 de deploys diferentes, cookie truncado ou editado).
 *
 * O @supabase/ssr junta os pedaços de `sb-<ref>-auth-token` e decodifica o valor `base64-…`; se o resultado
 * não for UTF-8 válido, `stringFromBase64URL` lança e derruba o `getUser()` (HTTP 500 em qualquer página).
 * Aqui identificamos esses cookies para o cliente de servidor ignorá-los e a resposta apagá-los.
 */

export interface CookieSimples {
  name: string;
  value: string;
}

const PREFIXO_BASE64 = "base64-";
// sb-<ref>-auth-token e sb-<ref>-auth-token-code-verifier, inteiros ou em pedaços (.0, .1…)
const COOKIE_SESSAO = /^(sb-.+-auth-token(?:-code-verifier)?)(?:\.(0|[1-9][0-9]*))?$/;
const ALFABETO_BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const IGNORADOS_BASE64URL = " \t\n\r=";

/** Base64-URL → bytes; null se tiver caractere fora do alfabeto (o @supabase/ssr também recusa). */
function bytesDeBase64URL(texto: string): Uint8Array | null {
  const bytes: number[] = [];
  let fila = 0;
  let bits = 0;
  for (const c of texto) {
    if (IGNORADOS_BASE64URL.includes(c)) continue;
    const v = ALFABETO_BASE64URL.indexOf(c);
    if (v < 0) return null;
    fila = ((fila << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((fila >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** O valor (já com os pedaços juntos) vira uma sessão legível? Só julga o formato `base64-…`. */
export function valorSessaoValido(valor: string): boolean {
  if (!valor.startsWith(PREFIXO_BASE64)) return true;
  const bytes = bytesDeBase64URL(valor.slice(PREFIXO_BASE64.length));
  if (!bytes) return false;
  try {
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return true;
  } catch {
    return false;
  }
}

/**
 * Nomes dos cookies de sessão a descartar (e apagar na resposta). Junta os pedaços como o @supabase/ssr:
 * o cookie inteiro, se existir, senão `.0`, `.1`… até o primeiro que faltar. Se o valor não decodifica,
 * descarta o grupo todo; pedaços que o @supabase/ssr nunca leria (sem o `.0`, ou depois de um buraco) também.
 * Cookies não relacionados ficam intactos.
 */
export function cookiesSessaoInvalidos(cookies: CookieSimples[]): string[] {
  const grupos = new Map<string, Map<string, string>>();
  for (const { name, value } of cookies) {
    const m = name.match(COOKIE_SESSAO);
    if (!m) continue;
    const chave = m[1];
    if (!grupos.has(chave)) grupos.set(chave, new Map());
    grupos.get(chave)!.set(name, value);
  }

  const descartar: string[] = [];
  for (const [chave, porNome] of grupos) {
    const usados = new Set<string>();
    let valor = porNome.get(chave) ?? "";
    if (valor) {
      usados.add(chave);
    } else {
      const pedacos: string[] = [];
      for (let i = 0; porNome.get(`${chave}.${i}`); i++) {
        pedacos.push(porNome.get(`${chave}.${i}`)!);
        usados.add(`${chave}.${i}`);
      }
      valor = pedacos.join("");
    }

    const invalido = valor !== "" && !valorSessaoValido(valor);
    for (const nome of porNome.keys()) {
      if (invalido || !usados.has(nome)) descartar.push(nome);
    }
  }
  return descartar;
}
