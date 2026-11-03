// Regras puras do chat (sem Supabase): nomes dos canais do Realtime, junção de mensagens
// e textos de data. A conexão com o Realtime fica em src/lib/chat-realtime.ts.
import type { MensagemChat } from "@/types";

// Espelho de pode_usar_topico_realtime (migração 26): mudar os dois juntos
export const topicoConversa = (conversaId: string) => `conversa:${conversaId}`;
export const topicoDigitando = (conversaId: string) => `conversa:${conversaId}:digitando`;
export const topicoUsuario = (usuarioId: number) => `usuario:${usuarioId}`;
// Chamado de suporte (migração 31): dono do chamado e equipe; só o banco publica
export const topicoChamado = (chamadoId: string) => `chamado:${chamadoId}`;

// Mensagem ainda não confirmada pelo banco (aparece na hora, com o id provisório negativo)
export interface MensagemTela extends MensagemChat {
  pendente?: boolean;
  falhou?: boolean;
}

// O que mesclarMensagens precisa (chat e chamados de suporte)
interface MensagemMesclavel {
  id: number;
  cliente_id: string;
  criado_em: string;
  pendente?: boolean;
  falhou?: boolean;
}

// Junta mensagens novas às da tela sem duplicar: a confirmada (mesmo cliente_id) substitui a provisória,
// e o Realtime pode entregar uma mensagem que a RPC já devolveu. Ordem: confirmadas por id, pendentes no fim.
export function mesclarMensagens<T extends MensagemMesclavel>(atuais: T[], novas: T[]): T[] {
  const porCliente = new Map<string, T>();
  for (const m of atuais) porCliente.set(m.cliente_id, m);
  for (const m of novas) {
    const existente = porCliente.get(m.cliente_id);
    // Uma provisória nunca sobrescreve a versão confirmada
    if (existente && !existente.pendente && m.pendente) continue;
    porCliente.set(m.cliente_id, existente ? { ...existente, ...m, pendente: m.pendente, falhou: m.falhou } : m);
  }
  const lista = Array.from(porCliente.values());
  const confirmadas = lista.filter((m) => !m.pendente && !m.falhou).sort((a, b) => a.id - b.id);
  const pendentes = lista
    .filter((m) => m.pendente || m.falhou)
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  return [...confirmadas, ...pendentes];
}

// Maior id confirmado (ponto de partida para buscar o que chegou durante uma queda de conexão)
export function ultimoIdConfirmado(mensagens: MensagemMesclavel[]): number | null {
  let maior: number | null = null;
  for (const m of mensagens) {
    if (!m.pendente && !m.falhou && (maior === null || m.id > maior)) maior = m.id;
  }
  return maior;
}

// "14:05" hoje, "ontem", "12/10" no ano, "12/10/2025" antes
export function horarioMensagem(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  if (isNaN(data.getTime())) return "";
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(data, agora)) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (mesmoDia(data, ontem)) return "ontem";
  if (data.getFullYear() === agora.getFullYear()) {
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return data.toLocaleDateString("pt-BR");
}

// Separador de dia na conversa: "Hoje", "Ontem" ou "12 de outubro"
export function rotuloDia(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  if (isNaN(data.getTime())) return "";
  if (data.toDateString() === agora.toDateString()) return "Hoje";
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    ...(data.getFullYear() === agora.getFullYear() ? {} : { year: "numeric" }),
  });
}
