// Envio de e-mail pela REST API do Resend (só servidor: rotas /api/suporte/*). Sem dependência nova.
// Sem RESEND_API_KEY o envio é pulado com log: o chamado funciona igual, só sem o e-mail.
import { EMAIL_SUPORTE, type EmailMontado } from "@/lib/suporte";

const REMETENTE = "Circular <nao-responda@eokinha.com.br>";

// Caixa da equipe que recebe o aviso de chamado novo (padrão: o endereço público do suporte)
export function emailDaEquipe(): string {
  return process.env.SUPORTE_EMAIL_EQUIPE?.trim() || EMAIL_SUPORTE;
}

// Nunca lança: falha de e-mail não pode desfazer o que já foi gravado no banco
export async function enviarEmail(para: string, email: EmailMontado): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.warn("E-mail de suporte pulado: RESEND_API_KEY não configurada");
    return false;
  }
  if (!para) return false;
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE,
        to: [para],
        reply_to: EMAIL_SUPORTE,
        subject: email.assunto,
        html: email.html,
        text: email.texto,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resposta.ok) {
      console.error("Resend recusou o e-mail de suporte", resposta.status, await resposta.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (erro) {
    console.error("Falha ao enviar e-mail de suporte", erro);
    return false;
  }
}
