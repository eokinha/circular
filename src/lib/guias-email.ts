// Como o aluno acessa o e-mail da faculdade: usado no cadastro, nas telas "Confira seu e-mail" e no /ajuda.
// O provedor de cada domínio saiu dos registros MX (out/2026). Formato do endereço, primeiro acesso e suporte
// só entram quando confirmados com alunos da faculdade; sem eles a tela mostra o texto genérico do provedor.

export type ProvedorEmail = "microsoft" | "google";

export interface Provedor {
  nome: string; // nome que o aluno reconhece
  url: string; // onde entrar pelo navegador
  app: string; // app no celular
  pastas: string[]; // onde procurar um e-mail que não apareceu na caixa de entrada
}

export const PROVEDORES: Record<ProvedorEmail, Provedor> = {
  microsoft: {
    nome: "Outlook",
    url: "https://outlook.office.com/mail/",
    app: "Outlook",
    pastas: ["Lixo Eletrônico", "a aba Outros (ao lado de Prioritário)"],
  },
  google: {
    nome: "Gmail",
    url: "https://mail.google.com/",
    app: "Gmail",
    pastas: ["Spam", "as abas Promoções e Atualizações"],
  },
};

export interface GuiaFaculdade {
  provedor: ProvedorEmail;
  formatoEndereco?: string; // ex.: "matricula@alunos.estacio.br"
  primeiroAcesso?: string; // como conseguir a senha na primeira vez
  suporte?: string; // onde pedir ajuda na faculdade
}

// Chave = domínio de instituicoes.dominios. Subdomínio (alunos.estacio.br) casa com o domínio pai.
export const GUIAS_POR_DOMINIO: Record<string, GuiaFaculdade> = {
  "unifacs.br": { provedor: "microsoft" },
  "ucsal.br": { provedor: "google" },
  "unijorge.edu.br": { provedor: "microsoft" },
  "unijorge.com.br": { provedor: "microsoft" },
  "aluno.faculdadezarns.com.br": { provedor: "microsoft" },
  "uniftc.edu.br": { provedor: "microsoft" },
  "estacio.br": { provedor: "microsoft" },
  "uninassau.edu.br": { provedor: "microsoft" },
  "uniruy.edu.br": { provedor: "microsoft" },
  "senaicimatec.com.br": { provedor: "microsoft" },
  "bahiana.edu.br": { provedor: "microsoft" },
};

export const REMETENTE_CIRCULAR = "nao-responda@eokinha.com.br";

export function dominioDoEmail(email: string): string {
  return email.toLowerCase().trim().split("@")[1] ?? "";
}

// Guia do domínio mais específico que casa com o e-mail, ou null (o tutorial cai no texto genérico)
export function guiaDoEmail(email: string): GuiaFaculdade | null {
  const dominio = dominioDoEmail(email);
  if (!dominio) return null;

  let melhor: GuiaFaculdade | null = null;
  let tamanho = 0;
  for (const [d, guia] of Object.entries(GUIAS_POR_DOMINIO)) {
    if ((dominio === d || dominio.endsWith(`.${d}`)) && d.length > tamanho) {
      melhor = guia;
      tamanho = d.length;
    }
  }
  return melhor;
}

// Guia de uma instituição: o do primeiro domínio dela que tiver guia
export function guiaDaInstituicao(dominios: string[] | null): GuiaFaculdade | null {
  for (const d of dominios ?? []) {
    const guia = GUIAS_POR_DOMINIO[d.toLowerCase().trim()];
    if (guia) return guia;
  }
  return null;
}
