// POST /api/suporte/responder { chamadoId, texto, clienteId } (só equipe): grava pela RPC admin_responder_chamado,
// que exige is_admin e devolve os dados do aviso; manda o e-mail ao aluno só quando a mensagem é nova.
import type { NextApiRequest, NextApiResponse } from "next";
import { aceitaPostJson, exigirLogin, responderErroBanco } from "@/lib/api-rotas";
import { enviarEmail } from "@/lib/email-resend";
import { LIMITES_CHAMADO, emailRespostaAluno } from "@/lib/suporte";
import { createApiClient } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!aceitaPostJson(req, res)) return;
  const chamadoId = String(req.body?.chamadoId ?? "");
  const clienteId = String(req.body?.clienteId ?? "");
  const texto = String(req.body?.texto ?? "").trim();
  if (!UUID.test(chamadoId) || !UUID.test(clienteId) || texto.length < 1 || texto.length > LIMITES_CHAMADO.mensagemMax) {
    return res.status(400).json({ erro: `Escreva a resposta com 1 a ${LIMITES_CHAMADO.mensagemMax} caracteres.` });
  }

  const supabase = createApiClient(req, res);
  if (!(await exigirLogin(supabase, res))) return;

  const { data, error } = await supabase.rpc("admin_responder_chamado", {
    p_chamado_id: chamadoId,
    p_texto: texto,
    p_cliente_id: clienteId,
  });
  if (error) return responderErroBanco(res, error);

  const aviso = data.aviso_email as
    | { para: string; nome: string | null; protocolo: string; assunto: string; categoria: string; chamado_id: string }
    | undefined;
  if (data.novo && aviso) {
    await enviarEmail(
      aviso.para,
      emailRespostaAluno({
        protocolo: aviso.protocolo,
        assunto: aviso.assunto,
        categoria: aviso.categoria,
        chamadoId: aviso.chamado_id,
        nome: aviso.nome,
        resposta: texto,
      })
    );
  }
  return res.status(200).json({ mensagem: data.mensagem, status: data.status });
}
