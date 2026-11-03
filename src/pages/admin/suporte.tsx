import { useCallback, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { ChevronLeft, ChevronRight, LifeBuoy } from "lucide-react";
import ConversaSuporte from "@/components/suporte/ConversaSuporte";
import { horarioMensagem } from "@/lib/chat";
import { formatarPrazo } from "@/lib/contas";
import { createServerClient } from "@/lib/supabase";
import { getChamadoAdmin, getFilaChamadosAdmin } from "@/lib/queries";
import {
  STATUS_CHAMADO,
  caminhoFilaAdmin,
  paginaDaQuery,
  rotuloCategoria,
  statusValido,
  totalDePaginas,
} from "@/lib/suporte";
import type { ChamadoAdmin, ChamadoAdminLeitura, FilaChamadosAdmin, StatusChamado } from "@/types";

type Filtro = StatusChamado | "todos";

interface Props {
  fila: FilaChamadosAdmin;
  filtro: Filtro;
  chamadoAberto: ChamadoAdminLeitura | null; // ?chamado=<id>
}

// Fila de chamados de suporte (migrações 31 e 34). Só admin (middleware + RPC). 20 por página, com filtro e
// página na URL (?status=&pagina=). Responder e resolver mandam e-mail ao aluno pelas rotas /api/suporte/*.
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const serverSupabase = createServerClient(ctx);
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const id = typeof ctx.query.chamado === "string" ? ctx.query.chamado : null;
  const valido = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const chamadoAberto = valido ? await getChamadoAdmin(id, serverSupabase) : null;
  const pagina = paginaDaQuery(ctx.query.pagina);

  const pedido = ctx.query.status;
  let filtro: Filtro;
  if (pedido === "todos") filtro = "todos";
  else if (statusValido(pedido)) filtro = pedido;
  else filtro = chamadoAberto ? chamadoAberto.status : "aberto";

  let fila = await getFilaChamadosAdmin(filtro === "todos" ? null : filtro, pagina, serverSupabase);
  // Sem filtro na URL e ninguém aguardando: abre direto em "Em atendimento"
  if (!statusValido(pedido) && pedido !== "todos" && !chamadoAberto && fila.total === 0 && fila.contagens.em_atendimento > 0) {
    filtro = "em_atendimento";
    fila = await getFilaChamadosAdmin(filtro, 1, serverSupabase);
  }
  // Página além do fim (ex.: chamados resolvidos saíram da fila): volta para a última
  const ultima = totalDePaginas(fila.total, fila.por_pagina);
  if (fila.pagina > ultima) {
    return { redirect: { destination: caminhoFilaAdmin({ status: filtro, pagina: ultima, chamado: chamadoAberto?.id }), permanent: false } };
  }
  return { props: { fila, filtro, chamadoAberto } };
};

const FILTROS: { valor: StatusChamado | "todos"; rotulo: string }[] = [
  { valor: "aberto", rotulo: "Aguardando" },
  { valor: "em_atendimento", rotulo: "Em atendimento" },
  { valor: "resolvido", rotulo: "Resolvidos" },
  { valor: "todos", rotulo: "Todos" },
];

const FOCO = "focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";
const LINK_TOPO = "text-xs font-semibold text-tinta-suave hover:text-tinta px-3 py-1.5 rounded-controle border border-borda hover:bg-pagina transition shrink-0";

function situacaoAluno(aluno: ChamadoAdmin["aluno"]): string | null {
  if (!aluno || aluno.conta_status === "ativo") return null;
  return aluno.bloqueado_ate ? `Suspensa até ${formatarPrazo(aluno.bloqueado_ate)}` : "Conta bloqueada";
}

export default function AdminSuportePage({ fila, filtro, chamadoAberto }: Props) {
  const [chamados, setChamados] = useState<ChamadoAdmin[]>(fila.itens);
  const [contagens, setContagens] = useState(fila.contagens);
  // Navegou para outra página/filtro (novos props do getServerSideProps): recomeça do que veio do servidor
  const [filaBase, setFilaBase] = useState(fila);
  if (filaBase !== fila) {
    setFilaBase(fila);
    setChamados(fila.itens);
    setContagens(fila.contagens);
  }

  const pagina = fila.pagina;
  const ultimaPagina = totalDePaginas(fila.total, fila.por_pagina);
  const inicio = fila.total === 0 ? 0 : (pagina - 1) * fila.por_pagina + 1;
  const fim = Math.min(pagina * fila.por_pagina, fila.total);

  // Status mudou na conversa: a fila e as contagens acompanham sem recarregar (a ordem só muda ao recarregar)
  const aoMudarStatus = useCallback(
    (status: StatusChamado) => {
      if (!chamadoAberto) return;
      const anterior = chamados.find((c) => c.id === chamadoAberto.id)?.status ?? chamadoAberto.status;
      if (anterior === status) return;
      setContagens((c) => ({ ...c, [anterior]: Math.max(0, c[anterior] - 1), [status]: c[status] + 1 }));
      setChamados((prev) => prev.map((c) => (c.id === chamadoAberto.id ? { ...c, status, nao_lidas: 0 } : c)));
    },
    [chamadoAberto, chamados]
  );

  const aluno = chamadoAberto?.aluno ?? null;

  return (
    <>
      <Head>
        <title>Suporte • Admin Circular</title>
      </Head>

      <div className="min-h-screen bg-pagina pb-16">
        <div className="bg-superficie border-b border-borda md:sticky md:top-[69px] z-20">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-tinta flex items-center gap-1.5 shrink-0">
              <LifeBuoy size={16} strokeWidth={1.75} aria-hidden="true" />
              Suporte
            </span>
            <nav aria-label="Outras telas do admin" className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
              <Link href="/admin/contas" className={LINK_TOPO}>
                Contas
              </Link>
              <Link href="/admin/denuncias" className={LINK_TOPO}>
                Denúncias
              </Link>
            </nav>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-petroleo tracking-tight">Chamados de suporte</h1>
          <p className="text-sm text-tinta-suave mt-1 mb-6">
            O aluno abre o chamado no painel e recebe por e-mail o protocolo, cada resposta da equipe e o aviso de
            resolvido. A conversa acontece aqui; o aluno vê só &ldquo;Equipe Circular&rdquo;, nunca quem respondeu.
          </p>

          <nav aria-label="Status dos chamados" className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
            {FILTROS.map((f) => (
              <Link
                key={f.valor}
                href={caminhoFilaAdmin({ status: f.valor })}
                aria-current={filtro === f.valor ? "page" : undefined}
                className={`inline-flex items-center px-4 min-h-[44px] rounded-pill text-sm font-semibold border shrink-0 transition ${FOCO} ${
                  filtro === f.valor
                    ? "bg-petroleo border-petroleo text-white"
                    : "bg-superficie border-borda-controle text-tinta-suave hover:border-petroleo"
                }`}
              >
                {f.rotulo} ({contagens[f.valor]})
              </Link>
            ))}
          </nav>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              {chamados.length === 0 ? (
                <p className="text-center text-sm text-tinta-suave py-12">Nenhum chamado aqui.</p>
              ) : (
                <ul className="bg-superficie border border-borda rounded-card divide-y divide-borda">
                  {chamados.map((c) => {
                    const ativo = chamadoAberto?.id === c.id;
                    const situacao = situacaoAluno(c.aluno);
                    return (
                      <li key={c.id}>
                        <Link
                          href={caminhoFilaAdmin({ status: filtro, pagina, chamado: c.id })}
                          aria-current={ativo ? "true" : undefined}
                          className={`block px-4 py-3 rounded-card ${ativo ? "bg-petroleo-50" : "hover:bg-pagina"} ${FOCO}`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs text-tinta-suave">
                            <span>
                              {c.protocolo} · {rotuloCategoria(c.categoria)}
                            </span>
                            <span>{horarioMensagem(c.atualizado_em)}</span>
                          </div>
                          <p className="font-semibold text-tinta truncate">{c.assunto}</p>
                          <p className="text-sm text-tinta-suave truncate">
                            {c.aluno?.nome ?? "Conta excluída"}
                            {situacao ? ` · ${situacao}` : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-semibold text-tinta-suave">{STATUS_CHAMADO[c.status]}</span>
                            {c.nao_lidas > 0 && (
                              <span className="rounded-pill bg-acao text-white text-xs font-semibold px-2 py-0.5">
                                {c.nao_lidas} nova{c.nao_lidas > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {fila.total > fila.por_pagina && (
                <nav aria-label="Páginas da fila" className="flex items-center justify-between gap-3 mt-4 text-sm">
                  {pagina > 1 ? (
                    <Link
                      href={caminhoFilaAdmin({ status: filtro, pagina: pagina - 1, chamado: chamadoAberto?.id })}
                      className={`inline-flex items-center gap-1 px-3 min-h-[44px] rounded-controle border border-borda-controle bg-superficie font-semibold text-tinta hover:border-petroleo ${FOCO}`}
                    >
                      <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                      Anterior
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-tinta-suave" aria-live="polite">
                    {inicio}–{fim} de {fila.total} · página {pagina} de {ultimaPagina}
                  </span>
                  {pagina < ultimaPagina ? (
                    <Link
                      href={caminhoFilaAdmin({ status: filtro, pagina: pagina + 1, chamado: chamadoAberto?.id })}
                      className={`inline-flex items-center gap-1 px-3 min-h-[44px] rounded-controle border border-borda-controle bg-superficie font-semibold text-tinta hover:border-petroleo ${FOCO}`}
                    >
                      Próxima
                      <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </div>

            <div>
              {chamadoAberto ? (
                <div className="space-y-3">
                  {aluno && (
                    <div className="bg-superficie border border-borda rounded-card px-4 py-3 text-sm">
                      <p className="font-semibold text-tinta">{aluno.nome}</p>
                      <p className="text-tinta-suave">
                        {aluno.nome_publico && aluno.nome_publico !== aluno.nome ? `${aluno.nome_publico} · ` : ""}
                        {aluno.instituicao ?? "Sem campus"}
                        {situacaoAluno(aluno) ? ` · ${situacaoAluno(aluno)}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-4 mt-1">
                        {aluno.slug && (
                          <Link href={`/perfil/${aluno.slug}`} target="_blank" className="text-petroleo font-semibold hover:underline">
                            Ver perfil
                          </Link>
                        )}
                        <Link href="/admin/contas" className="text-petroleo font-semibold hover:underline">
                          Moderar conta
                        </Link>
                      </div>
                    </div>
                  )}
                  <div className="bg-superficie border border-borda rounded-card overflow-hidden h-[70vh] min-h-[420px]">
                    <ConversaSuporte key={chamadoAberto.id} chamado={chamadoAberto} equipe onStatus={aoMudarStatus} />
                  </div>
                </div>
              ) : (
                <p className="text-center text-sm text-tinta-suave py-12 bg-superficie border border-borda rounded-card">
                  Escolha um chamado na lista.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
