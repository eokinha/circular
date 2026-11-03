import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { Ban, Check, Clock, ExternalLink, Flag, History, Search, TriangleAlert, Users } from "lucide-react";
import Paginacao from "@/components/admin/Paginacao";
import { useConfirmacao } from "@/components/ModalConfirmacao";
import { createServerClient } from "@/lib/supabase";
import { getContasPagina, getHistoricoConta, moderarConta } from "@/lib/queries";
import {
  DIAS_SUSPENSAO,
  MOTIVO_MODERACAO,
  formatarPrazo,
  motivoValido,
  rotuloAcaoConta,
  situacaoDaConta,
  type Situacao,
} from "@/lib/contas";
import { BUSCA_ADMIN_MAX, buscaDaQuery, caminhoComQuery, paginaDaQuery, totalDePaginas } from "@/lib/paginacao";
import type { ContasPagina, EventoModeracaoConta, FiltroContas, UsuarioModeracao } from "@/types";

type Filtro = FiltroContas;

interface Props {
  contas: ContasPagina;
  filtro: Filtro;
  busca: string;
}

const FILTROS_VALIDOS: Filtro[] = ["todas", "ativa", "suspensa", "bloqueada", "denuncias"];

function caminhoContas(filtro: Filtro, busca: string, pagina = 1): string {
  return caminhoComQuery("/admin/contas", { filtro: filtro === "todas" ? null : filtro, q: busca, pagina });
}

// Moderação de contas (migrações 27 e 35). A matrícula é verificada pelo e-mail da faculdade, então aqui a equipe
// só suspende (com prazo), bloqueia (sem prazo) ou reativa contas. Só admin (middleware + RPC).
// 20 por página; filtro, busca e página na URL (?filtro=&q=&pagina=).
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const serverSupabase = createServerClient(ctx);
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const pedido = ctx.query.filtro;
  const filtro: Filtro = FILTROS_VALIDOS.includes(pedido as Filtro) ? (pedido as Filtro) : "todas";
  const busca = buscaDaQuery(ctx.query.q);
  const contas = await getContasPagina(filtro, busca, paginaDaQuery(ctx.query.pagina), serverSupabase);
  const ultima = totalDePaginas(contas.total, contas.por_pagina);
  if (contas.pagina > ultima) {
    return { redirect: { destination: caminhoContas(filtro, busca, ultima), permanent: false } };
  }
  return { props: { contas, filtro, busca } };
};

const FOCO = "focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";
const BOTAO_SECUNDARIO = `min-h-[44px] px-3 rounded-controle border border-borda-controle bg-superficie text-petroleo text-sm font-semibold hover:border-petroleo transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${FOCO}`;
const BOTAO_PERIGO = `min-h-[44px] px-3 rounded-controle border border-borda-controle bg-superficie text-tinta text-sm font-semibold hover:border-perigo hover:text-perigo transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${FOCO}`;
const LINK_TOPO = "text-xs font-semibold text-tinta-suave hover:text-tinta px-3 py-1.5 rounded-controle border border-borda hover:bg-pagina transition shrink-0";

function SeloSituacao({ usuario }: { usuario: UsuarioModeracao }) {
  const situacao = situacaoDaConta(usuario.status, usuario.bloqueado_ate);
  if (situacao === "ativa") return null;
  return (
    <span className="rounded-pill text-xs font-semibold px-2.5 py-1 bg-perigo-50 text-perigo inline-flex items-center gap-1">
      {situacao === "suspensa" ? <Clock size={14} strokeWidth={1.75} aria-hidden="true" /> : <Ban size={14} strokeWidth={1.75} aria-hidden="true" />}
      {situacao === "suspensa" && usuario.bloqueado_ate ? `Suspensa até ${formatarPrazo(usuario.bloqueado_ate)}` : "Bloqueada"}
    </span>
  );
}

interface PropsForm {
  usuario: UsuarioModeracao;
  acao: "suspender" | "bloquear";
  onCancelar: () => void;
  onFeito: (atualizado: Partial<UsuarioModeracao>, mensagem: string) => void;
}

// Suspender pede prazo e motivo; bloquear, só o motivo. O aluno vê o motivo no painel.
function FormModeracao({ usuario, acao, onCancelar, onFeito }: PropsForm) {
  const [dias, setDias] = useState<number>(7);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const ate = await moderarConta(usuario.id, acao, motivo.trim(), acao === "suspender" ? dias : null);
      onFeito(
        { status: "bloqueado", bloqueado_ate: ate, moderacao_motivo: motivo.trim(), anuncios_ativos: 0 },
        acao === "suspender"
          ? `${usuario.nome} está suspenso até ${ate ? formatarPrazo(ate) : ""}. A conta volta sozinha no fim do prazo.`
          : `${usuario.nome} foi bloqueado.`
      );
    } catch (err) {
      setErro((err as { message?: string })?.message || "Não foi possível moderar a conta.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleEnviar} className="mt-3 border-t border-borda pt-3 flex flex-col gap-3">
      {acao === "suspender" && (
        <fieldset>
          <legend className="text-sm font-semibold text-tinta mb-2">Por quanto tempo?</legend>
          <div className="flex flex-wrap gap-2">
            {DIAS_SUSPENSAO.map((d) => (
              <label
                key={d}
                className={`min-h-[44px] px-4 rounded-pill border text-sm font-semibold inline-flex items-center cursor-pointer transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-petroleo has-[:focus-visible]:outline-offset-2 ${
                  dias === d ? "bg-petroleo border-petroleo text-white" : "bg-superficie border-borda-controle text-tinta-suave hover:border-petroleo"
                }`}
              >
                <input type="radio" name={`dias-${usuario.id}`} value={d} checked={dias === d} onChange={() => setDias(d)} className="sr-only" />
                {d === 1 ? "1 dia" : `${d} dias`}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="text-sm font-semibold text-tinta">
        Motivo (o aluno vê este texto no painel)
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_MODERACAO.maximo}
          rows={2}
          required
          placeholder="Ex.: Pediu PIX adiantado em mais de um anúncio."
          className={`mt-1 w-full font-normal px-3 py-2 rounded-controle border border-borda-controle bg-superficie text-sm text-tinta resize-y ${FOCO}`}
        />
      </label>
      <p className="text-xs text-tinta-suave -mt-2">
        O perfil sai do ar e os anúncios ativos são pausados.
        {acao === "suspender" ? " No fim do prazo o perfil volta; os anúncios o aluno reativa." : " Fica assim até alguém da equipe reativar."}
      </p>
      {erro && (
        <p role="alert" className="text-perigo text-sm">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={onCancelar} className={BOTAO_SECUNDARIO}>
          Cancelar
        </button>
        <button type="submit" disabled={enviando || !motivoValido(motivo)} className={BOTAO_PERIGO}>
          {enviando ? "Salvando…" : acao === "suspender" ? `Suspender por ${dias === 1 ? "1 dia" : `${dias} dias`}` : "Bloquear conta"}
        </button>
      </div>
    </form>
  );
}

function Historico({ eventos }: { eventos: EventoModeracaoConta[] }) {
  if (eventos.length === 0) {
    return <p className="mt-3 border-t border-borda pt-3 text-sm text-tinta-suave">Nenhuma moderação registrada nesta conta.</p>;
  }
  return (
    <ol className="mt-3 border-t border-borda pt-3 flex flex-col gap-2">
      {eventos.map((e) => (
        <li key={e.id} className="text-sm">
          <span className="font-semibold text-tinta">{rotuloAcaoConta(e.acao)}</span>
          {e.acao === "suspender" && e.ate && <span className="text-tinta"> até {formatarPrazo(e.ate)}</span>}
          <span className="text-tinta-suave">
            {" "}
            · {formatarPrazo(e.criado_em)} · {e.admin_nome ?? "automático"}
          </span>
          {e.motivo && <p className="text-tinta-suave">{e.motivo}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function AdminContasPage({ contas, filtro, busca }: Props) {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<UsuarioModeracao[]>(contas.itens);
  const [textoBusca, setTextoBusca] = useState(busca);
  // Navegou para outra página/filtro/busca (novos props do getServerSideProps): recomeça do servidor
  const [contasBase, setContasBase] = useState(contas);
  if (contasBase !== contas) {
    setContasBase(contas);
    setUsuarios(contas.itens);
    setTextoBusca(busca);
  }
  const [form, setForm] = useState<{ id: number; acao: "suspender" | "bloquear" } | null>(null);
  const [historicos, setHistoricos] = useState<Record<number, EventoModeracaoConta[] | undefined>>({});
  const [historicoAberto, setHistoricoAberto] = useState<number | null>(null);
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const { confirmar, modalConfirmacao } = useConfirmacao();

  // Contagens do servidor (com a busca aplicada); mudanças feitas aqui aparecem nelas ao recarregar
  const contagem = contas.contagens;
  const filtrados = usuarios;

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    router.push(caminhoContas(filtro, textoBusca.trim()));
  }

  function atualizar(id: number, alteracoes: Partial<UsuarioModeracao>) {
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...alteracoes } : u)));
    setHistoricos((prev) => ({ ...prev, [id]: undefined })); // recarrega na próxima abertura
    if (historicoAberto === id) setHistoricoAberto(null);
  }

  async function handleHistorico(usuario: UsuarioModeracao) {
    if (historicoAberto === usuario.id) {
      setHistoricoAberto(null);
      return;
    }
    setForm(null);
    setAviso(null);
    if (!historicos[usuario.id]) {
      setProcessandoId(usuario.id);
      try {
        const eventos = await getHistoricoConta(usuario.id);
        setHistoricos((prev) => ({ ...prev, [usuario.id]: eventos }));
      } catch (err) {
        setAviso({ tipo: "erro", texto: (err as { message?: string })?.message || "Não foi possível carregar o histórico." });
        return;
      } finally {
        setProcessandoId(null);
      }
    }
    setHistoricoAberto(usuario.id);
  }

  async function handleReativar(usuario: UsuarioModeracao) {
    const ok = await confirmar({
      titulo: `Reativar a conta de ${usuario.nome}?`,
      mensagem: "O perfil volta ao ar. Os anúncios continuam pausados até o aluno reativar.",
      rotuloConfirmar: "Reativar",
    });
    if (!ok) return;
    setProcessandoId(usuario.id);
    setAviso(null);
    try {
      await moderarConta(usuario.id, "reativar");
      atualizar(usuario.id, { status: "ativo", bloqueado_ate: null, moderacao_motivo: null });
      setAviso({ tipo: "sucesso", texto: `A conta de ${usuario.nome} foi reativada.` });
    } catch (err) {
      setAviso({ tipo: "erro", texto: (err as { message?: string })?.message || "Não foi possível reativar." });
    } finally {
      setProcessandoId(null);
    }
  }

  const FILTROS: { valor: Filtro; rotulo: string }[] = [
    { valor: "todas", rotulo: "Todas" },
    { valor: "denuncias", rotulo: "Com denúncias" },
    { valor: "suspensa", rotulo: "Suspensas" },
    { valor: "bloqueada", rotulo: "Bloqueadas" },
    { valor: "ativa", rotulo: "Ativas" },
  ];

  return (
    <>
      <Head>
        <title>Contas • Admin Circular</title>
      </Head>

      <div className="min-h-screen bg-pagina pb-16">
        <div className="bg-superficie border-b border-borda md:sticky md:top-[69px] z-20">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-tinta flex items-center gap-1.5 shrink-0">
              <Users size={16} strokeWidth={1.75} aria-hidden="true" />
              Contas
            </span>
            <nav aria-label="Outras telas do admin" className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <Link href="/admin/denuncias" className={LINK_TOPO}>
                Denúncias
              </Link>
              <Link href="/admin/comentarios" className={LINK_TOPO}>
                Comentários
              </Link>
              <Link href="/admin/lojas" className={LINK_TOPO}>
                Perfis
              </Link>
            </nav>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-petroleo tracking-tight">Moderação de contas</h1>
          <p className="text-sm text-tinta-suave mt-1 mb-6">
            A matrícula é verificada pelo e-mail da faculdade. Aqui a equipe define o status de cada conta: ativa, suspensa por um prazo ou
            bloqueada sem prazo. Toda mudança fica no histórico da conta.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            <nav aria-label="Situação da conta" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {FILTROS.map((f) => (
                <Link
                  key={f.valor}
                  href={caminhoContas(f.valor, busca)}
                  aria-current={filtro === f.valor ? "page" : undefined}
                  className={`inline-flex items-center px-4 min-h-[44px] rounded-pill text-sm font-semibold border shrink-0 transition ${FOCO} ${
                    filtro === f.valor
                      ? "bg-petroleo border-petroleo text-white"
                      : "bg-superficie border-borda-controle text-tinta-suave hover:border-petroleo"
                  }`}
                >
                  {f.rotulo} ({contagem[f.valor]})
                </Link>
              ))}
            </nav>
            <form role="search" onSubmit={handleBuscar} className="flex gap-2 w-full sm:max-w-md">
              <input
                type="search"
                value={textoBusca}
                onChange={(e) => setTextoBusca(e.target.value)}
                maxLength={BUSCA_ADMIN_MAX}
                placeholder="Buscar por nome, e-mail ou faculdade"
                aria-label="Buscar contas"
                className={`flex-1 min-w-0 min-h-[44px] px-4 rounded-pill border border-borda-controle bg-superficie text-sm text-tinta placeholder:text-tinta-sutil ${FOCO}`}
              />
              <button type="submit" className={BOTAO_SECUNDARIO}>
                <Search size={16} strokeWidth={1.75} aria-hidden="true" />
                Buscar
              </button>
            </form>
          </div>

          {aviso && (
            <p
              role={aviso.tipo === "erro" ? "alert" : "status"}
              className={`mb-4 p-3 rounded-card text-sm flex items-start gap-2 ${
                aviso.tipo === "sucesso" ? "bg-troca-50 text-troca-texto" : "bg-perigo-50 text-perigo"
              }`}
            >
              {aviso.tipo === "sucesso" ? (
                <Check size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <TriangleAlert size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
              )}
              {aviso.texto}
            </p>
          )}

          {filtrados.length === 0 ? (
            <p className="text-center text-sm text-tinta-suave py-12">Nenhuma conta neste filtro.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtrados.map((u) => {
                const situacao = situacaoDaConta(u.status, u.bloqueado_ate);
                const ocupado = processandoId === u.id;
                return (
                  <li key={u.id} className="bg-superficie border border-borda rounded-card p-4">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-tinta break-words">
                            {u.nome} {u.sobrenome}
                          </p>
                          {u.is_admin && (
                            <span className="rounded-pill text-xs font-semibold px-2.5 py-1 bg-petroleo-50 text-petroleo">Equipe</span>
                          )}
                          <SeloSituacao usuario={u} />
                        </div>
                        <p className="text-sm text-tinta-suave break-all">
                          {u.email}
                          {u.telefone ? ` · ${u.telefone}` : ""}
                        </p>
                        <p className="text-xs text-tinta-suave mt-1">
                          {u.instituicao_nome ?? "Sem campus"}
                          {u.criado_em ? ` · desde ${new Date(u.criado_em).toLocaleDateString("pt-BR")}` : ""}
                          {` · ${u.anuncios_ativos} ${u.anuncios_ativos === 1 ? "anúncio ativo" : "anúncios ativos"}`}
                        </p>
                        {u.denuncias_abertas > 0 && (
                          <Link
                            href="/admin/denuncias"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-perigo hover:underline"
                          >
                            <Flag size={14} strokeWidth={1.75} aria-hidden="true" />
                            {u.denuncias_abertas} {u.denuncias_abertas === 1 ? "denúncia aberta" : "denúncias abertas"}
                          </Link>
                        )}
                        {situacao !== "ativa" && u.moderacao_motivo && (
                          <p className="text-sm text-tinta mt-2">
                            <span className="font-semibold">Motivo:</span> {u.moderacao_motivo}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end lg:max-w-md">
                        {u.loja_id && (
                          <Link href={`/perfil/${u.loja_id}`} target="_blank" className={BOTAO_SECUNDARIO}>
                            <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
                            Perfil
                          </Link>
                        )}
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => handleHistorico(u)}
                          aria-expanded={historicoAberto === u.id}
                          className={BOTAO_SECUNDARIO}
                        >
                          <History size={16} strokeWidth={1.75} aria-hidden="true" />
                          Histórico
                        </button>
                        {/* Status da conta: Suspensa pede prazo e motivo; Bloqueada, o motivo; Ativa reativa.
                            Escolher Suspensa numa conta já suspensa troca o prazo. */}
                        {!u.is_admin && (
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-tinta">
                            Status da conta
                            <select
                              value={form?.id === u.id ? (form.acao === "suspender" ? "suspensa" : "bloqueada") : situacao}
                              disabled={ocupado}
                              onChange={(e) => {
                                const novo = e.target.value as Situacao;
                                setHistoricoAberto(null);
                                setAviso(null);
                                if (novo === "ativa") {
                                  setForm(null);
                                  if (situacao !== "ativa") handleReativar(u);
                                } else {
                                  setForm({ id: u.id, acao: novo === "suspensa" ? "suspender" : "bloquear" });
                                }
                              }}
                              className={`min-h-[44px] pl-3 pr-8 rounded-controle border border-borda-controle bg-superficie text-sm font-semibold text-tinta disabled:opacity-50 ${FOCO}`}
                            >
                              <option value="ativa">Ativa</option>
                              <option value="suspensa">Suspensa</option>
                              <option value="bloqueada">Bloqueada</option>
                            </select>
                          </label>
                        )}
                      </div>
                    </div>

                    {form?.id === u.id && (
                      <FormModeracao
                        key={form.acao}
                        usuario={u}
                        acao={form.acao}
                        onCancelar={() => setForm(null)}
                        onFeito={(alteracoes, mensagem) => {
                          atualizar(u.id, alteracoes);
                          setForm(null);
                          setAviso({ tipo: "sucesso", texto: mensagem });
                        }}
                      />
                    )}
                    {historicoAberto === u.id && historicos[u.id] && <Historico eventos={historicos[u.id]!} />}
                  </li>
                );
              })}
            </ul>
          )}
          <Paginacao
            pagina={contas.pagina}
            total={contas.total}
            porPagina={contas.por_pagina}
            rotulo="Páginas de contas"
            hrefPagina={(n) => caminhoContas(filtro, busca, n)}
          />
        </div>
      </div>
      {modalConfirmacao}
    </>
  );
}
