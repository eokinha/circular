// Suporte (migração 31): regras puras dos chamados e textos dos e-mails de atendimento.
// Os limites e as categorias espelham os CHECK de chamados/chamado_mensagens e as RPCs: mudar os dois juntos.
// O envio pelo Resend fica em src/lib/email-resend.ts (só servidor).
import type { CategoriaChamado, StatusChamado } from "@/types";

// Endereço único do suporte (mailto: no login, /ajuda, Footer e Política de Privacidade; reply-to dos e-mails)
export const EMAIL_SUPORTE = "suporte@eokinha.com.br";

export const SITE_CIRCULAR = "https://circular.eokinha.com.br";

export const CATEGORIAS_CHAMADO: { valor: CategoriaChamado; rotulo: string }[] = [
  { valor: "conta", rotulo: "Conta suspensa ou bloqueada" },
  { valor: "acesso", rotulo: "Login, senha ou e-mail" },
  { valor: "anuncio", rotulo: "Meus anúncios ou perfil" },
  { valor: "negociacao", rotulo: "Problema com outro aluno" },
  { valor: "privacidade", rotulo: "Meus dados (LGPD)" },
  { valor: "outro", rotulo: "Outro assunto" },
];

export const STATUS_CHAMADO: Record<StatusChamado, string> = {
  aberto: "Aguardando a equipe",
  em_atendimento: "Em atendimento",
  resolvido: "Resolvido",
};

export const LIMITES_CHAMADO = {
  assuntoMin: 5,
  assuntoMax: 120,
  descricaoMin: 10,
  mensagemMax: 2000,
  emAndamento: 3, // chamados não resolvidos ao mesmo tempo
} as const;

export function rotuloCategoria(categoria: string): string {
  return CATEGORIAS_CHAMADO.find((c) => c.valor === categoria)?.rotulo ?? "Outro assunto";
}

export function categoriaValida(valor: unknown): valor is CategoriaChamado {
  return typeof valor === "string" && CATEGORIAS_CHAMADO.some((c) => c.valor === valor);
}

export function statusValido(valor: unknown): valor is StatusChamado {
  return typeof valor === "string" && Object.hasOwn(STATUS_CHAMADO, valor);
}

// Problema do formulário de novo chamado (mesma regra de abrir_chamado), ou null
export function problemaNovoChamado(categoria: string, assunto: string, descricao: string): string | null {
  if (!categoriaValida(categoria)) return "Escolha o assunto do chamado.";
  const a = assunto.trim().length;
  if (a < LIMITES_CHAMADO.assuntoMin || a > LIMITES_CHAMADO.assuntoMax) {
    return `O título precisa ter de ${LIMITES_CHAMADO.assuntoMin} a ${LIMITES_CHAMADO.assuntoMax} caracteres.`;
  }
  const d = descricao.trim().length;
  if (d < LIMITES_CHAMADO.descricaoMin || d > LIMITES_CHAMADO.mensagemMax) {
    return `Conte o que aconteceu em ${LIMITES_CHAMADO.descricaoMin} a ${LIMITES_CHAMADO.mensagemMax} caracteres.`;
  }
  return null;
}

// mailto: do suporte com assunto opcional (quem não consegue entrar no site)
export function linkMailtoSuporte(assunto?: string): string {
  return `mailto:${EMAIL_SUPORTE}${assunto ? `?subject=${encodeURIComponent(assunto)}` : ""}`;
}

export function caminhoChamado(chamadoId: string, equipe = false): string {
  return `${equipe ? "/admin/suporte" : "/painel/suporte"}?chamado=${encodeURIComponent(chamadoId)}`;
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function dataHoraBahia(iso: string): string {
  const data = new Date(iso);
  if (isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Bahia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// E-mails de atendimento (formalizam; a conversa continua no chat do chamado)
// ---------------------------------------------------------------------------

export interface EmailMontado {
  assunto: string;
  html: string;
  texto: string;
}

export interface DadosChamadoEmail {
  protocolo: string;
  assunto: string;
  categoria: string;
  chamadoId: string;
  nome?: string | null; // primeiro nome do aluno
}

// Bloco de texto do aluno/equipe: escapado e com quebras de linha preservadas
function paragrafoHtml(texto: string): string {
  return escaparHtml(texto).replace(/\r?\n/g, "<br>");
}

function layout(titulo: string, corpoHtml: string, link: string, rotuloLink: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f6f3;font-family:Arial,Helvetica,sans-serif;color:#1c2b2f">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:16px;padding:24px">
<p style="margin:0 0 16px;font-weight:bold;color:#0f4c5c;font-size:18px">Circular</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#0f4c5c">${escaparHtml(titulo)}</h1>
${corpoHtml}
<p style="margin:24px 0 0"><a href="${escaparHtml(link)}" style="display:inline-block;background:#0f4c5c;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escaparHtml(rotuloLink)}</a></p>
</div>
<p style="font-size:12px;color:#55656a;margin:16px 0 0">Este e-mail registra o seu atendimento no Circular. Para conversar com a equipe, use o chat do chamado. Dúvidas: ${EMAIL_SUPORTE}.</p>
</div></body></html>`;
}

function linhaProtocolo(d: DadosChamadoEmail): string {
  return `<p style="margin:0 0 8px"><strong>Protocolo:</strong> ${escaparHtml(d.protocolo)}<br><strong>Assunto:</strong> ${escaparHtml(d.assunto)}<br><strong>Tipo:</strong> ${escaparHtml(rotuloCategoria(d.categoria))}</p>`;
}

function textoProtocolo(d: DadosChamadoEmail): string {
  return `Protocolo: ${d.protocolo}\nAssunto: ${d.assunto}\nTipo: ${rotuloCategoria(d.categoria)}`;
}

function saudacao(nome?: string | null): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  return primeiro ? `Olá, ${primeiro}!` : "Olá!";
}

export function emailAberturaAluno(d: DadosChamadoEmail, base = SITE_CIRCULAR): EmailMontado {
  const link = base + caminhoChamado(d.chamadoId);
  const assunto = `Recebemos seu chamado ${d.protocolo}`;
  const html = layout(
    "Recebemos seu chamado",
    `<p style="margin:0 0 12px">${escaparHtml(saudacao(d.nome))} A equipe do Circular recebeu o seu pedido e vai responder pelo chat do chamado. Avisamos por aqui quando houver resposta.</p>${linhaProtocolo(d)}`,
    link,
    "Acompanhar o chamado"
  );
  const texto = `${saudacao(d.nome)} A equipe do Circular recebeu o seu pedido e vai responder pelo chat do chamado.\n\n${textoProtocolo(d)}\n\nAcompanhe: ${link}`;
  return { assunto, html, texto };
}

export function emailAberturaEquipe(
  d: DadosChamadoEmail & { descricao: string; aluno: string },
  base = SITE_CIRCULAR
): EmailMontado {
  const link = base + caminhoChamado(d.chamadoId, true);
  const assunto = `[Suporte] ${d.protocolo}: ${d.assunto.replace(/[\r\n]+/g, " ").trim()}`;
  const html = layout(
    "Chamado novo",
    `<p style="margin:0 0 12px"><strong>Aluno:</strong> ${escaparHtml(d.aluno)}</p>${linhaProtocolo(d)}<p style="margin:12px 0 0;padding:12px;background:#f7f6f3;border-radius:8px">${paragrafoHtml(d.descricao)}</p>`,
    link,
    "Responder no admin"
  );
  const texto = `Chamado novo\nAluno: ${d.aluno}\n${textoProtocolo(d)}\n\n${d.descricao}\n\nResponder: ${link}`;
  return { assunto, html, texto };
}

export function emailRespostaAluno(d: DadosChamadoEmail & { resposta: string }, base = SITE_CIRCULAR): EmailMontado {
  const link = base + caminhoChamado(d.chamadoId);
  const assunto = `Nova resposta no chamado ${d.protocolo}`;
  const html = layout(
    "A equipe respondeu seu chamado",
    `<p style="margin:0 0 12px">${escaparHtml(saudacao(d.nome))}</p>${linhaProtocolo(d)}<p style="margin:12px 0 0;padding:12px;background:#f7f6f3;border-radius:8px">${paragrafoHtml(d.resposta)}</p><p style="margin:12px 0 0">Para responder, abra o chamado no Circular (respostas a este e-mail não entram no chat).</p>`,
    link,
    "Abrir o chamado"
  );
  const texto = `${saudacao(d.nome)} A equipe respondeu seu chamado.\n\n${textoProtocolo(d)}\n\n${d.resposta}\n\nPara responder, abra o chamado: ${link}`;
  return { assunto, html, texto };
}

export function emailResolucaoAluno(
  d: DadosChamadoEmail & { abertoEm: string; resolvidoEm: string; ultimaResposta?: string | null },
  base = SITE_CIRCULAR
): EmailMontado {
  const link = base + caminhoChamado(d.chamadoId);
  const assunto = `Chamado ${d.protocolo} resolvido`;
  const periodo = `Aberto em ${dataHoraBahia(d.abertoEm)} e encerrado em ${dataHoraBahia(d.resolvidoEm)}.`;
  const resumo = d.ultimaResposta?.trim()
    ? `<p style="margin:12px 0 4px"><strong>Última resposta da equipe:</strong></p><p style="margin:0;padding:12px;background:#f7f6f3;border-radius:8px">${paragrafoHtml(d.ultimaResposta)}</p>`
    : "";
  const html = layout(
    "Seu chamado foi resolvido",
    `<p style="margin:0 0 12px">${escaparHtml(saudacao(d.nome))} A equipe encerrou este atendimento. Se o problema continuar, abra um novo chamado no painel.</p>${linhaProtocolo(d)}<p style="margin:0">${escaparHtml(periodo)}</p>${resumo}`,
    link,
    "Ver o atendimento"
  );
  const texto = `${saudacao(d.nome)} A equipe encerrou este atendimento.\n\n${textoProtocolo(d)}\n${periodo}${
    d.ultimaResposta?.trim() ? `\n\nÚltima resposta da equipe:\n${d.ultimaResposta}` : ""
  }\n\nVer o atendimento: ${link}`;
  return { assunto, html, texto };
}
