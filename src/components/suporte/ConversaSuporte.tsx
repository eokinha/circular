import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CircleCheck, RotateCw, Send } from "lucide-react";
import { horarioMensagem, mesclarMensagens, rotuloDia, ultimoIdConfirmado } from "@/lib/chat";
import { assinarChamado } from "@/lib/chat-realtime";
import {
  enviarMensagemChamado,
  getMensagensDoChamado,
  marcarChamadoLido,
  mudarStatusChamado,
  responderChamado,
} from "@/lib/queries";
import { LIMITES_CHAMADO, STATUS_CHAMADO, dataHoraBahia, rotuloCategoria } from "@/lib/suporte";
import type { ChamadoLeitura, MensagemChamado, StatusChamado } from "@/types";

interface Props {
  chamado: ChamadoLeitura;
  // true = tela da equipe (/admin/suporte): responde pela rota /api (e-mail ao aluno) e muda o status
  equipe?: boolean;
  onStatus?: (status: StatusChamado) => void;
}

interface MensagemTela extends MensagemChamado {
  pendente?: boolean;
  falhou?: boolean;
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";
const BOTAO_SECUNDARIO = `bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle text-sm font-semibold transition ${FOCO}`;

let proximoIdProvisorio = -1;

function mensagemDeErro(err: unknown): string {
  // Falha de rede (fetch) chega como TypeError; erro do banco ou da rota /api traz a mensagem amigável
  if (err instanceof TypeError) return "Não foi possível enviar. Confira a conexão e tente de novo.";
  const { code, message } = (err as { code?: string; message?: string }) ?? {};
  if (code === undefined || code.startsWith("PT") || code === "22023") return message || "Não foi possível enviar.";
  return "Não foi possível enviar. Confira a conexão e tente de novo.";
}

// Conversa do chamado em tempo real (canal privado chamado:{id}); o envio é sempre pela RPC ou pela rota /api,
// e a cada conexão busca o que faltou. O aluno nunca vê qual pessoa da equipe respondeu.
export default function ConversaSuporte({ chamado, equipe = false, onStatus }: Props) {
  const chamadoId = chamado.id;
  const [mensagens, setMensagens] = useState<MensagemTela[]>(chamado.mensagens);
  const [status, setStatus] = useState<StatusChamado>(chamado.status);
  const [texto, setTexto] = useState("");
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const mensagensRef = useRef(mensagens);
  const listaRef = useRef<HTMLDivElement>(null);

  const minha = useCallback((m: MensagemChamado) => m.de_equipe === equipe, [equipe]);

  const marcarLido = useCallback(() => {
    if (document.visibilityState === "visible") marcarChamadoLido(chamadoId).catch(() => undefined);
  }, [chamadoId]);

  const aplicarStatus = useCallback(
    (novo: StatusChamado) => {
      setStatus(novo);
      onStatus?.(novo);
    },
    [onStatus]
  );

  useEffect(() => {
    marcarLido();
    const aoVoltar = () => marcarLido();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [marcarLido]);

  useEffect(() => {
    const canal = assinarChamado(chamadoId, {
      onMensagem: (m) => {
        setMensagens((atuais) => mesclarMensagens(atuais, [m]));
        if (m.de_equipe !== equipe) marcarLido();
      },
      onStatus: aplicarStatus,
      onSincronizar: () => {
        getMensagensDoChamado(chamadoId, ultimoIdConfirmado(mensagensRef.current) ?? 0)
          .then((novas) => {
            if (novas.length === 0) return;
            setMensagens((atuais) => mesclarMensagens(atuais, novas));
            if (novas.some((m) => m.de_equipe !== equipe)) marcarLido();
          })
          .catch(() => undefined);
      },
    });
    return () => canal.sair();
  }, [chamadoId, equipe, marcarLido, aplicarStatus]);

  useEffect(() => {
    mensagensRef.current = mensagens;
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensagens]);

  async function enviar(conteudo: string, clienteId: string) {
    const provisoria: MensagemTela = {
      id: proximoIdProvisorio--,
      chamado_id: chamadoId,
      de_equipe: equipe,
      texto: conteudo,
      cliente_id: clienteId,
      criado_em: new Date().toISOString(),
      lida_em: null,
      pendente: true,
    };
    setMensagens((atuais) => mesclarMensagens(atuais.filter((m) => m.cliente_id !== clienteId), [provisoria]));
    try {
      if (equipe) {
        const r = await responderChamado(chamadoId, conteudo, clienteId);
        setMensagens((atuais) => mesclarMensagens(atuais, [{ ...r.mensagem, pendente: false, falhou: false }]));
        aplicarStatus(r.status);
      } else {
        const confirmada = await enviarMensagemChamado(chamadoId, conteudo, clienteId);
        setMensagens((atuais) => mesclarMensagens(atuais, [{ ...confirmada, pendente: false, falhou: false }]));
      }
    } catch (err) {
      setErroEnvio(mensagemDeErro(err));
      setMensagens((atuais) =>
        atuais.map((m) => (m.cliente_id === clienteId ? { ...m, pendente: false, falhou: true } : m))
      );
    }
  }

  function handleEnviar(e?: FormEvent) {
    e?.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo) return;
    setErroEnvio(null);
    setTexto("");
    enviar(conteudo, crypto.randomUUID());
  }

  function handleTecla(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleEnviar();
    }
  }

  async function handleStatus(novo: StatusChamado) {
    setMudandoStatus(true);
    setErroEnvio(null);
    try {
      const r = await mudarStatusChamado(chamadoId, novo);
      aplicarStatus(r.status);
    } catch (err) {
      setErroEnvio((err as { message?: string })?.message || "Não foi possível mudar o status.");
    } finally {
      setMudandoStatus(false);
    }
  }

  const resolvido = status === "resolvido";
  // Aluno não escreve em chamado resolvido; a equipe pode (a resposta reabre o atendimento)
  const podeEscrever = equipe || !resolvido;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-borda px-4 py-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-tinta-suave">
            Protocolo {chamado.protocolo} · {rotuloCategoria(chamado.categoria)}
          </p>
          <h2 className="font-semibold text-tinta break-words">{chamado.assunto}</h2>
          <p className="text-xs text-tinta-suave mt-0.5">Aberto em {dataHoraBahia(chamado.criado_em)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            role="status"
            className={`rounded-pill text-xs font-semibold px-2.5 py-1 ${
              resolvido ? "bg-superficie border border-borda text-tinta-suave" : "bg-petroleo-50 text-petroleo"
            }`}
          >
            {STATUS_CHAMADO[status]}
          </span>
          {equipe && (
            <>
              {status === "aberto" && (
                <button type="button" disabled={mudandoStatus} onClick={() => handleStatus("em_atendimento")} className={`min-h-[44px] px-3 ${BOTAO_SECUNDARIO} disabled:opacity-50`}>
                  Assumir
                </button>
              )}
              {resolvido ? (
                <button type="button" disabled={mudandoStatus} onClick={() => handleStatus("em_atendimento")} className={`min-h-[44px] px-3 ${BOTAO_SECUNDARIO} disabled:opacity-50`}>
                  Reabrir
                </button>
              ) : (
                <button type="button" disabled={mudandoStatus} onClick={() => handleStatus("resolvido")} className={`min-h-[44px] px-3 inline-flex items-center gap-1.5 ${BOTAO_SECUNDARIO} disabled:opacity-50`}>
                  <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                  Marcar como resolvido
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div ref={listaRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 bg-pagina">
        <ol className="flex flex-col gap-1.5" aria-label="Mensagens do chamado">
          {mensagens.map((m, i) => {
            const daqui = minha(m);
            const anterior = mensagens[i - 1];
            const novoDia = !anterior || new Date(anterior.criado_em).toDateString() !== new Date(m.criado_em).toDateString();
            const autor = m.de_equipe ? "Equipe Circular" : equipe ? "Aluno" : "Você";
            return (
              <Fragment key={m.cliente_id}>
                {novoDia && (
                  <li className="text-center my-2" aria-hidden="true">
                    <span className="text-xs font-semibold text-tinta-suave bg-superficie border border-borda rounded-pill px-3 py-1">
                      {rotuloDia(m.criado_em)}
                    </span>
                  </li>
                )}
                <li className={`flex flex-col ${daqui ? "items-end" : "items-start"}`}>
                  <span className="text-xs font-semibold text-tinta-suave px-1 mb-0.5">{autor}</span>
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-card px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                      daqui ? "bg-petroleo text-white" : "bg-superficie border border-borda text-tinta"
                    } ${m.pendente ? "opacity-70" : ""}`}
                  >
                    {m.texto}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 px-1 text-xs text-tinta-sutil">
                    <span>{horarioMensagem(m.criado_em)}</span>
                    {m.pendente && <span>Enviando…</span>}
                    {m.falhou && (
                      <button
                        type="button"
                        onClick={() => {
                          setErroEnvio(null);
                          enviar(m.texto, m.cliente_id);
                        }}
                        className={`inline-flex items-center gap-1 text-perigo font-semibold hover:underline rounded-controle ${FOCO}`}
                      >
                        <RotateCw size={12} strokeWidth={1.75} aria-hidden="true" />
                        Não enviada. Tentar de novo
                      </button>
                    )}
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ol>
      </div>

      <div className="border-t border-borda bg-superficie px-3 sm:px-4 py-3">
        {!podeEscrever ? (
          <p className="text-sm text-tinta-suave">
            Este atendimento foi encerrado. Se o problema continuar, abra um novo chamado.
          </p>
        ) : (
          <form onSubmit={handleEnviar} className="flex items-end gap-2">
            <label htmlFor="campo-mensagem-chamado" className="sr-only">
              {equipe ? "Resposta ao aluno" : "Mensagem para a equipe"}
            </label>
            <textarea
              id="campo-mensagem-chamado"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleTecla}
              maxLength={LIMITES_CHAMADO.mensagemMax}
              rows={1}
              placeholder={equipe ? "Responda ao aluno (ele recebe um aviso por e-mail)" : "Escreva para a equipe"}
              className={`flex-1 resize-none max-h-32 min-h-[44px] px-4 py-2.5 rounded-controle border border-borda-controle focus:border-petroleo bg-superficie text-sm text-tinta placeholder:text-tinta-sutil field-sizing-content ${FOCO}`}
            />
            <button
              type="submit"
              disabled={!texto.trim()}
              aria-label="Enviar mensagem"
              className={`w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-controle bg-acao hover:bg-acao-hover text-white transition disabled:opacity-50 ${FOCO}`}
            >
              <Send size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
        )}
        {erroEnvio && (
          <p role="alert" className="text-perigo text-sm mt-2">
            {erroEnvio}
          </p>
        )}
      </div>
    </div>
  );
}
