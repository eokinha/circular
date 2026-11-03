import { useCallback, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { LifeBuoy } from "lucide-react";
import ConversaSuporte from "@/components/suporte/ConversaSuporte";
import { horarioMensagem } from "@/lib/chat";
import { formatarPrazo } from "@/lib/contas";
import { createServerClient } from "@/lib/supabase";
import { getChamadoAdmin, getChamadosAdmin } from "@/lib/queries";
import { STATUS_CHAMADO, caminhoChamado, rotuloCategoria } from "@/lib/suporte";
import type { ChamadoAdmin, ChamadoAdminLeitura, StatusChamado } from "@/types";

interface Props {
  chamadosIniciais: ChamadoAdmin[];
  chamadoAberto: ChamadoAdminLeitura | null; // ?chamado=<id>
}

// Fila de chamados de suporte (migração 31). Só admin (middleware + RPC). Responder e resolver mandam
// e-mail ao aluno pelas rotas /api/suporte/*.
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
  const [chamadosIniciais, chamadoAberto] = await Promise.all([
    getChamadosAdmin(null, serverSupabase),
    valido ? getChamadoAdmin(id, serverSupabase) : Promise.resolve(null),
  ]);
  return { props: { chamadosIniciais, chamadoAberto } };
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

export default function AdminSuportePage({ chamadosIniciais, chamadoAberto }: Props) {
  const [chamados, setChamados] = useState<ChamadoAdmin[]>(chamadosIniciais);
  const [filtro, setFiltro] = useState<StatusChamado | "todos">(
    chamadoAberto ? chamadoAberto.status : chamadosIniciais.some((c) => c.status === "aberto") ? "aberto" : "em_atendimento"
  );

  const filtrados = useMemo(
    () => (filtro === "todos" ? chamados : chamados.filter((c) => c.status === filtro)),
    [chamados, filtro]
  );

  // Status mudou na conversa: a fila acompanha sem recarregar
  const aoMudarStatus = useCallback(
    (status: StatusChamado) => {
      if (!chamadoAberto) return;
      setChamados((prev) => prev.map((c) => (c.id === chamadoAberto.id ? { ...c, status, nao_lidas: 0 } : c)));
    },
    [chamadoAberto]
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

          <div role="tablist" aria-label="Status dos chamados" className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                role="tab"
                aria-selected={filtro === f.valor}
                onClick={() => setFiltro(f.valor)}
                className={`px-4 min-h-[44px] rounded-pill text-sm font-semibold border shrink-0 transition ${FOCO} ${
                  filtro === f.valor
                    ? "bg-petroleo border-petroleo text-white"
                    : "bg-superficie border-borda-controle text-tinta-suave hover:border-petroleo"
                }`}
              >
                {f.rotulo} ({f.valor === "todos" ? chamados.length : chamados.filter((c) => c.status === f.valor).length})
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              {filtrados.length === 0 ? (
                <p className="text-center text-sm text-tinta-suave py-12">Nenhum chamado aqui.</p>
              ) : (
                <ul className="bg-superficie border border-borda rounded-card divide-y divide-borda">
                  {filtrados.map((c) => {
                    const ativo = chamadoAberto?.id === c.id;
                    const situacao = situacaoAluno(c.aluno);
                    return (
                      <li key={c.id}>
                        <Link
                          href={caminhoChamado(c.id, true)}
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
