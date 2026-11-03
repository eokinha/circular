// POST /api/suporte/status { chamadoId, status } (só equipe): muda pela RPC admin_status_chamado (exige is_admin).
// Ao resolver, manda ao aluno o e-mail de encerramento com o resumo (só se o status mudou de fato).
import type { NextApiRequest, NextApiResponse } from "next";
import { aceitaPostJson, exigirLogin, responderErroBanco } from "@/lib/api-rotas";
import { enviarEmail } from "@/lib/email-resend";
import { emailResolucaoAluno, statusValido } from "@/lib/suporte";
import { createApiClient } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!aceitaPostJson(req, res)) return;
  const chamadoId = String(req.body?.chamadoId ?? "");
  const status = req.body?.status;
  if (!UUID.test(chamadoId) || !statusValido(status)) {
    return res.status(400).json({ erro: "Pedido inválido." });
  }

  const supabase = createApiClient(req, res);
  if (!(await exigirLogin(supabase, res))) return;

  const { data, error } = await supabase.rpc("admin_status_chamado", { p_chamado_id: chamadoId, p_status: status });
  if (error) return responderErroBanco(res, error);

  const aviso = data.aviso_email as
    | {
        para: string;
        nome: string | null;
        protocolo: string;
        assunto: string;
        categoria: string;
        chamado_id: string;
        criado_em: string;
        resolvido_em: string;
        ultima_resposta: string | null;
      }
    | null
    | undefined;
  if (data.mudou && aviso) {
    await enviarEmail(
      aviso.para,
      emailResolucaoAluno({
        protocolo: aviso.protocolo,
        assunto: aviso.assunto,
        categoria: aviso.categoria,
        chamadoId: aviso.chamado_id,
        nome: aviso.nome,
        abertoEm: aviso.criado_em,
        resolvidoEm: aviso.resolvido_em,
        ultimaResposta: aviso.ultima_resposta,
      })
    );
  }
  return res.status(200).json({ status: data.status, resolvido_em: data.resolvido_em ?? null });
}
