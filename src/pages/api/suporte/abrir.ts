// POST /api/suporte/abrir { categoria, assunto, descricao, clienteId }: abre o chamado pela RPC abrir_chamado
// (também para conta suspensa/bloqueada) e manda os e-mails de protocolo ao aluno e de aviso à equipe.
// O e-mail do aluno vem do Auth (sessão validada no servidor), nunca do corpo da requisição.
import type { NextApiRequest, NextApiResponse } from "next";
import { aceitaPostJson, responderErroBanco } from "@/lib/api-rotas";
import { emailDaEquipe, enviarEmail } from "@/lib/email-resend";
import { emailAberturaAluno, emailAberturaEquipe, problemaNovoChamado } from "@/lib/suporte";
import { createApiClient } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!aceitaPostJson(req, res)) return;
  const categoria = String(req.body?.categoria ?? "");
  const assunto = String(req.body?.assunto ?? "").trim();
  const descricao = String(req.body?.descricao ?? "").trim();
  const clienteId = String(req.body?.clienteId ?? "");
  const problema = problemaNovoChamado(categoria, assunto, descricao) ?? (UUID.test(clienteId) ? null : "Pedido inválido.");
  if (problema) return res.status(400).json({ erro: problema });

  const supabase = createApiClient(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ erro: "Faça login para continuar.", codigo: "42501" });

  const { data, error } = await supabase.rpc("abrir_chamado", {
    p_categoria: categoria,
    p_assunto: assunto,
    p_texto: descricao,
    p_cliente_id: clienteId,
  });
  if (error) return responderErroBanco(res, error);

  const chamado = data.chamado as { id: string; protocolo: string; categoria: string; assunto: string };
  // Reenvio do mesmo formulário não manda e-mail de novo
  if (data.novo) {
    const nome = typeof data.meu_nome === "string" ? data.meu_nome : "";
    const dados = { protocolo: chamado.protocolo, assunto: chamado.assunto, categoria: chamado.categoria, chamadoId: chamado.id };
    await Promise.allSettled([
      enviarEmail(user.email ?? "", emailAberturaAluno({ ...dados, nome })),
      enviarEmail(emailDaEquipe(), emailAberturaEquipe({ ...dados, descricao, aluno: nome || "Aluno sem nome" })),
    ]);
  }
  return res.status(200).json({ id: chamado.id, protocolo: chamado.protocolo });
}
