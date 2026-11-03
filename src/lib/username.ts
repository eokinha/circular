// Nome de usuário do aluno = lojas.slug, usado no link do perfil (/perfil/{usuario}) — migração 29.
// Espelho da regra do banco (username_valido + definir_username): mudar os dois juntos.
//   3 a 30 caracteres; letras minúsculas sem acento, números e . _ - (não no começo, no fim nem repetidos);
//   não pode ser só número (número é o id do perfil), nem "aluno-<número>" (padrão do cadastro),
//   nem usar termo reservado à equipe.
import { TERMOS_RESERVADOS_NOME } from "./validacoes.ts";

export const USERNAME = { minimo: 3, maximo: 30 } as const;
// Intervalo entre trocas (a primeira troca, saindo do aluno-<id>, é livre)
export const DIAS_ENTRE_TROCAS_USERNAME = 30;

const FORMATO = /^[a-z0-9]+([._-][a-z0-9]+)*$/;

// O que o aluno digita → como fica gravado: sem @ e espaços nas pontas, minúsculo
export function normalizarUsername(texto: string): string {
  return texto.trim().replace(/^@+/, "").toLowerCase();
}

export function problemaUsername(texto: string): string | null {
  const u = normalizarUsername(texto);
  if (u.length < USERNAME.minimo) return `O nome de usuário precisa ter pelo menos ${USERNAME.minimo} caracteres.`;
  if (u.length > USERNAME.maximo) return `O nome de usuário pode ter até ${USERNAME.maximo} caracteres.`;
  if (!FORMATO.test(u)) {
    return "Use só letras sem acento, números, ponto, hífen ou sublinhado (sem começar, terminar ou repetir os símbolos).";
  }
  if (/^[0-9]+$/.test(u)) return "O nome de usuário precisa ter pelo menos uma letra.";
  if (/^aluno-[0-9]+$/.test(u)) return "Esse formato é reservado aos perfis novos. Escolha outro nome.";
  if (TERMOS_RESERVADOS_NOME.some((termo) => u.includes(termo))) {
    return "Esse nome usa um termo reservado à equipe do Circular (como Circular, Admin, Suporte ou Oficial).";
  }
  return null;
}

// Perfil que ainda está no endereço criado no cadastro
export function usernamePadrao(slug: string | null | undefined): boolean {
  return !slug || /^aluno-[0-9]+$/.test(slug);
}
