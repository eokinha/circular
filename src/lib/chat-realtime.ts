// Conexão com o Supabase Realtime (Broadcast em canais privados; autorização por RLS em
// realtime.messages, migração 26). Só o banco publica mensagens; o navegador publica só o "digitando".
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { topicoChamado, topicoConversa, topicoDigitando, topicoUsuario } from "@/lib/chat";
import type { MensagemChamado, MensagemChat, StatusChamado } from "@/types";

interface EventosConversa {
  onMensagem: (mensagem: MensagemChat) => void;
  onLida: (dados: { leitor_id: number; ate_id: number }) => void;
  onBloqueio: (bloqueadaPor: number | null) => void;
  onDigitando: (autorId: number) => void;
  // Conectou (ou reconectou): buscar o que chegou enquanto o canal estava fora
  onSincronizar: () => void;
}

interface EventosUsuario {
  onNovaMensagem: (dados: { conversa_id: string; mensagem_id: number; autor_id: number; texto: string; criado_em: string }) => void;
  onConversaLida: (conversaId: string) => void;
  onSincronizar?: () => void;
}

function abrirCanal(topico: string, configurar: (canal: RealtimeChannel) => RealtimeChannel, aoConectar?: () => void) {
  let canal: RealtimeChannel | null = null;
  let encerrado = false;

  // Canais privados exigem o token do aluno no socket antes de entrar
  supabase.realtime
    .setAuth()
    .catch(() => undefined)
    .then(() => {
      if (encerrado) return;
      canal = configurar(supabase.channel(topico, { config: { private: true, broadcast: { self: false } } }));
      canal.subscribe((status) => {
        if (status === "SUBSCRIBED") aoConectar?.();
      });
    });

  return {
    canal: () => canal,
    sair: () => {
      encerrado = true;
      if (canal) supabase.removeChannel(canal);
    },
  };
}

export function assinarConversa(conversaId: string, meuId: number, eventos: EventosConversa) {
  const principal = abrirCanal(
    topicoConversa(conversaId),
    (canal) =>
      canal
        .on("broadcast", { event: "mensagem" }, ({ payload }) => {
          const m = payload as MensagemChat;
          eventos.onMensagem({ ...m, id: Number(m.id), autor_id: Number(m.autor_id) });
        })
        .on("broadcast", { event: "lida" }, ({ payload }) => {
          eventos.onLida({ leitor_id: Number(payload.leitor_id), ate_id: Number(payload.ate_id) });
        })
        .on("broadcast", { event: "bloqueio" }, ({ payload }) => {
          eventos.onBloqueio(payload.bloqueada_por === null ? null : Number(payload.bloqueada_por));
        }),
    eventos.onSincronizar
  );

  const digitando = abrirCanal(topicoDigitando(conversaId), (canal) =>
    canal.on("broadcast", { event: "digitando" }, ({ payload }) => {
      const autor = Number(payload.autor_id);
      if (autor !== meuId) eventos.onDigitando(autor);
    })
  );

  let ultimoAviso = 0;
  return {
    // No máximo um aviso a cada 2 s enquanto o aluno digita
    avisarDigitando: () => {
      const agora = Date.now();
      const canal = digitando.canal();
      if (!canal || agora - ultimoAviso < 2000) return;
      ultimoAviso = agora;
      canal.send({ type: "broadcast", event: "digitando", payload: { autor_id: meuId } }).catch(() => undefined);
    },
    sair: () => {
      principal.sair();
      digitando.sair();
    },
  };
}

// Caixa de entrada do aluno: mensagem nova em qualquer conversa e conversa lida em outra aba.
// A Navbar e a página de mensagens ouvem o mesmo tópico: um canal só, com a lista de ouvintes
// (o cliente do Realtime não aceita dois canais com o mesmo tópico no mesmo socket).
const canaisUsuario = new Map<number, { ouvintes: Set<EventosUsuario>; sair: () => void }>();

export function assinarUsuario(usuarioId: number, eventos: EventosUsuario) {
  let registro = canaisUsuario.get(usuarioId);
  if (!registro) {
    const ouvintes = new Set<EventosUsuario>();
    const canal = abrirCanal(
      topicoUsuario(usuarioId),
      (c) =>
        c
          .on("broadcast", { event: "nova_mensagem" }, ({ payload }) => {
            const dados = {
              conversa_id: String(payload.conversa_id),
              mensagem_id: Number(payload.mensagem_id),
              autor_id: Number(payload.autor_id),
              texto: String(payload.texto ?? ""),
              criado_em: String(payload.criado_em),
            };
            ouvintes.forEach((o) => o.onNovaMensagem(dados));
          })
          .on("broadcast", { event: "conversa_lida" }, ({ payload }) => {
            ouvintes.forEach((o) => o.onConversaLida(String(payload.conversa_id)));
          }),
      () => ouvintes.forEach((o) => o.onSincronizar?.())
    );
    registro = { ouvintes, sair: canal.sair };
    canaisUsuario.set(usuarioId, registro);
  }

  const atual = registro;
  atual.ouvintes.add(eventos);
  return {
    sair: () => {
      atual.ouvintes.delete(eventos);
      if (atual.ouvintes.size === 0) {
        atual.sair();
        canaisUsuario.delete(usuarioId);
      }
    },
  };
}

// Chamado de suporte (migração 31): mensagem nova e mudança de status, para o aluno e para a equipe.
// Como no chat, a cada conexão o componente busca o que chegou enquanto o canal estava fora.
export function assinarChamado(
  chamadoId: string,
  eventos: {
    onMensagem: (mensagem: MensagemChamado) => void;
    onStatus: (status: StatusChamado) => void;
    onSincronizar: () => void;
  }
) {
  const canal = abrirCanal(
    topicoChamado(chamadoId),
    (c) =>
      c
        .on("broadcast", { event: "mensagem" }, ({ payload }) => {
          const m = payload as MensagemChamado;
          eventos.onMensagem({ ...m, id: Number(m.id), de_equipe: Boolean(m.de_equipe) });
        })
        .on("broadcast", { event: "status" }, ({ payload }) => {
          eventos.onStatus(String(payload.status) as StatusChamado);
        }),
    eventos.onSincronizar
  );
  return { sair: canal.sair };
}
