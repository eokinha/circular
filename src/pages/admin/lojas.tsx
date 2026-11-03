import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useConfirmacao } from "@/components/ModalConfirmacao";
import Paginacao from "@/components/admin/Paginacao";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { createServerClient } from "@/lib/supabase";
import { getLojasPagina, getProdutosPagina, moderarLoja, definirDestaque } from "@/lib/queries";
import { BUSCA_ADMIN_MAX, buscaDaQuery, caminhoComQuery, paginaDaQuery, totalDePaginas } from "@/lib/paginacao";
import type { LojaModeracao, LojaStatus, LojasPagina, ProdutoModeracao, ProdutosPagina } from "@/types";
import { Package, Search, ShieldCheck, Star, Store } from "lucide-react";

type Aba = "lojas" | "produtos";

interface Estado {
  aba: Aba;
  status: LojaStatus | "todos";
  destaque: boolean;
  busca: string;
  pagina: number;
}

interface Props {
  estado: Estado;
  lojas: LojasPagina; // na aba Anúncios, só a 1ª página (para as contagens)
  produtos: ProdutosPagina; // na aba Perfis, só a 1ª página (para o total de destaques)
}

const STATUS_VALIDOS: LojaStatus[] = ["ativo", "pendente", "pausado", "reprovado"];

// /admin/lojas?aba=produtos&status=&destaque=1&q=&pagina= (página 1, aba Perfis e "todos" ficam fora)
function caminhoLojas(e: Partial<Estado>): string {
  return caminhoComQuery("/admin/lojas", {
    aba: e.aba === "produtos" ? "produtos" : null,
    status: e.aba !== "produtos" && e.status && e.status !== "todos" ? e.status : null,
    destaque: e.aba === "produtos" && e.destaque ? 1 : null,
    q: e.busca,
    pagina: e.pagina,
  });
}

// Moderação de perfis e impulsionados (migração 35): 20 por página, filtro e busca no banco
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const serverSupabase = createServerClient(ctx);
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const q = ctx.query;
  const aba: Aba = q.aba === "produtos" ? "produtos" : "lojas";
  const status = STATUS_VALIDOS.includes(q.status as LojaStatus) ? (q.status as LojaStatus) : "todos";
  const estado: Estado = {
    aba,
    status,
    destaque: q.destaque === "1",
    busca: buscaDaQuery(q.q),
    pagina: paginaDaQuery(q.pagina),
  };

  const [lojas, produtos] = await Promise.all([
    getLojasPagina(status === "todos" ? null : status, aba === "lojas" ? estado.busca : "", aba === "lojas" ? estado.pagina : 1, serverSupabase),
    getProdutosPagina(estado.destaque, aba === "produtos" ? estado.busca : "", aba === "produtos" ? estado.pagina : 1, serverSupabase),
  ]);

  const atual = aba === "lojas" ? lojas : produtos;
  const ultima = totalDePaginas(atual.total, atual.por_pagina);
  if (atual.pagina > ultima) {
    return { redirect: { destination: caminhoLojas({ ...estado, pagina: ultima }), permanent: false } };
  }

  return { props: { estado, lojas, produtos } };
};

const STATUS_LOJA: { valor: LojaStatus; rotulo: string; classe: string }[] = [
  { valor: "ativo", rotulo: "Ativa", classe: "bg-troca-50 text-troca-texto border-troca" },
  { valor: "pendente", rotulo: "Pendente", classe: "bg-doacao-50 text-doacao border-doacao" },
  { valor: "pausado", rotulo: "Pausada", classe: "bg-pagina text-tinta-suave border-borda" },
  { valor: "reprovado", rotulo: "Reprovada", classe: "bg-perigo-50 text-perigo border-perigo" },
];

function badgeLoja(status: LojaStatus) {
  const s = STATUS_LOJA.find((x) => x.valor === status) ?? STATUS_LOJA[0];
  return (
    <span className={`inline-flex text-xs font-bold px-2.5 py-0.5 rounded-pill border ${s.classe}`}>
      {s.rotulo}
    </span>
  );
}

const PILULA = "text-xs px-4 py-1.5 rounded-pill font-bold border transition whitespace-nowrap";

export default function AdminLojasPage({ estado, lojas: paginaLojas, produtos: paginaProdutos }: Props) {
  const router = useRouter();
  const { aba } = estado;
  const { confirmar, modalConfirmacao } = useConfirmacao();
  const [lojas, setLojas] = useState<LojaModeracao[]>(paginaLojas.itens);
  const [produtos, setProdutos] = useState<ProdutoModeracao[]>(paginaProdutos.itens);
  const [totalDestaques, setTotalDestaques] = useState(paginaProdutos.total_destaques);
  const [textoBusca, setTextoBusca] = useState(estado.busca);
  const [processando, setProcessando] = useState<string | null>(null);
  const [notificacao, setNotificacao] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Navegou (novos props do getServerSideProps): recomeça do que veio do servidor
  const [base, setBase] = useState({ paginaLojas, paginaProdutos });
  if (base.paginaLojas !== paginaLojas || base.paginaProdutos !== paginaProdutos) {
    setBase({ paginaLojas, paginaProdutos });
    setLojas(paginaLojas.itens);
    setProdutos(paginaProdutos.itens);
    setTotalDestaques(paginaProdutos.total_destaques);
    setTextoBusca(estado.busca);
  }

  // Contagens do servidor (na aba Perfis, com a busca aplicada)
  const contagens = paginaLojas.contagens;

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    router.push(caminhoLojas({ ...estado, busca: textoBusca.trim(), pagina: 1 }));
  }

  async function handleStatusLoja(loja: LojaModeracao, status: LojaStatus) {
    if (status === loja.status) return;
    if (
      status === "reprovado" &&
      !(await confirmar({
        titulo: "Reprovar perfil?",
        mensagem: `"${loja.nome}" e os anúncios dele saem do catálogo. Só a equipe pode reativar.`,
        rotuloConfirmar: "Reprovar",
        perigo: true,
      }))
    )
      return;

    setProcessando(`loja-${loja.id}`);
    setNotificacao(null);
    try {
      await moderarLoja(loja.id, status);
      setLojas((prev) => prev.map((l) => (l.id === loja.id ? { ...l, status } : l)));
      setNotificacao({ tipo: "sucesso", texto: `Loja "${loja.nome}" atualizada.` });
    } catch (err) {
      setNotificacao({ tipo: "erro", texto: (err as { message?: string })?.message || "Erro ao atualizar a loja." });
    } finally {
      setProcessando(null);
    }
  }

  async function handleDestaque(produto: ProdutoModeracao) {
    const novo = !produto.destaque;
    setProcessando(`produto-${produto.id}`);
    setNotificacao(null);
    try {
      await definirDestaque(produto.id, novo);
      setProdutos((prev) => prev.map((p) => (p.id === produto.id ? { ...p, destaque: novo } : p)));
      setTotalDestaques((t) => Math.max(0, t + (novo ? 1 : -1)));
      setNotificacao({
        tipo: "sucesso",
        texto: novo ? `"${produto.nome}" impulsionado na home.` : `"${produto.nome}" removido dos destaques.`,
      });
    } catch (err) {
      setNotificacao({ tipo: "erro", texto: (err as { message?: string })?.message || "Erro ao atualizar o destaque." });
    } finally {
      setProcessando(null);
    }
  }

  return (
    <>
      <Head>
        <title>Lojas e destaques • Admin Circular</title>
      </Head>

      <div className="min-h-screen bg-pagina pb-16">
        <div className="bg-superficie border-b border-borda md:sticky md:top-[69px] z-20">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-tinta flex items-center gap-1.5 shrink-0">
              <Store size={16} strokeWidth={1.75} aria-hidden="true" />
              Perfis
            </span>
            <nav aria-label="Outras telas do admin" className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
              <Link
                href="/admin/contas"
                className="text-xs font-semibold text-tinta-suave hover:text-tinta px-3 py-1.5 rounded-controle border border-borda hover:bg-pagina transition shrink-0"
              >
                Contas
              </Link>
              <Link
                href="/admin/imagens"
                className="text-xs font-semibold text-tinta-suave hover:text-tinta px-3 py-1.5 rounded-controle border border-borda hover:bg-pagina transition shrink-0"
              >
                Imagens
              </Link>
              <Link
                href="/admin/denuncias"
                className="text-xs font-semibold text-tinta-suave hover:text-tinta px-3 py-1.5 rounded-controle border border-borda hover:bg-pagina transition shrink-0"
              >
                Denúncias
              </Link>
            </nav>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-petroleo tracking-tight">Moderação de lojas e produtos</h1>
            <p className="text-xs text-tinta-suave mt-1">
              Altere o status das lojas e escolha quais produtos ficam impulsionados na home.
            </p>
          </div>

          {notificacao && (
            <div
              role={notificacao.tipo === "erro" ? "alert" : "status"}
              className={`mb-6 p-4 rounded-controle text-xs font-semibold border ${
                notificacao.tipo === "sucesso"
                  ? "bg-troca-50 text-troca-texto border-troca"
                  : "bg-perigo-50 text-perigo border-perigo"
              }`}
            >
              {notificacao.texto}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {STATUS_LOJA.map((s) => (
              <div key={s.valor} className="bg-superficie border border-borda rounded-controle p-4">
                <p className="text-xs font-bold text-tinta-suave uppercase tracking-wider">Lojas {s.rotulo.toLowerCase()}s</p>
                <p className="text-2xl font-bold text-tinta mt-1">{contagens[s.valor]}</p>
              </div>
            ))}
          </div>

          <div className="bg-superficie border border-borda rounded-controle p-3 sm:p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <Link
                href={caminhoLojas({ aba: "lojas" })}
                aria-current={aba === "lojas" ? "page" : undefined}
                className={`${PILULA} ${aba === "lojas" ? "bg-petroleo border-petroleo text-white" : "border-borda-controle text-tinta-suave hover:border-petroleo"}`}
              >
                Lojas ({contagens.todos})
              </Link>
              <Link
                href={caminhoLojas({ aba: "produtos" })}
                aria-current={aba === "produtos" ? "page" : undefined}
                className={`${PILULA} ${aba === "produtos" ? "bg-petroleo border-petroleo text-white" : "border-borda-controle text-tinta-suave hover:border-petroleo"}`}
              >
                Produtos ({totalDestaques} em destaque)
              </Link>

              <span className="mx-1 h-5 w-px bg-pagina" />

              {aba === "lojas" ? (
                <select
                  value={estado.status}
                  aria-label="Status do perfil"
                  onChange={(e) =>
                    router.push(caminhoLojas({ ...estado, status: e.target.value as LojaStatus | "todos", pagina: 1 }))
                  }
                  className="text-xs px-3 py-1.5 rounded-pill border border-borda-controle text-tinta-suave bg-superficie"
                >
                  <option value="todos">Todos os status</option>
                  {STATUS_LOJA.map((s) => (
                    <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                  ))}
                </select>
              ) : (
                <Link
                  href={caminhoLojas({ ...estado, destaque: !estado.destaque, pagina: 1 })}
                  aria-current={estado.destaque ? "true" : undefined}
                  className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-pill border transition whitespace-nowrap ${
                    estado.destaque ? "border-petroleo text-petroleo bg-perigo-50" : "border-borda-controle text-tinta-suave"
                  }`}
                >
                  <Star size={16} strokeWidth={1.75} aria-hidden="true" /> Só destaques
                </Link>
              )}
            </div>

            <form role="search" onSubmit={handleBuscar} className="flex gap-2 w-full sm:w-auto">
              <input
                type="search"
                value={textoBusca}
                onChange={(e) => setTextoBusca(e.target.value)}
                maxLength={BUSCA_ADMIN_MAX}
                aria-label={aba === "lojas" ? "Buscar loja, dono ou e-mail" : "Buscar produto ou loja"}
                placeholder={aba === "lojas" ? "Buscar loja, dono ou e-mail..." : "Buscar produto ou loja..."}
                className="flex-1 min-w-0 sm:w-64 text-xs px-4 py-2 rounded-pill border border-borda focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 focus:border-petroleo bg-pagina"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="inline-flex items-center justify-center px-3 py-2 rounded-pill border border-borda-controle text-petroleo hover:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
              >
                <Search size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </form>
          </div>

          {aba === "lojas" ? (
            <>
              <div className="bg-superficie border border-borda rounded-controle overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-pagina border-b border-borda text-tinta-suave uppercase text-xs font-bold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Loja</th>
                        <th className="py-3.5 px-4">Dono</th>
                        <th className="py-3.5 px-4">Produtos</th>
                        <th className="py-3.5 px-4">Interesses</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Alterar status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borda">
                      {lojas.map((l) => (
                        <tr key={l.id} className="hover:bg-pagina transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-tinta">{l.nome}</div>
                            {l.slug && (
                              <Link href={`/lojas/${l.slug}`} target="_blank" className="text-xs text-tinta-suave hover:text-petroleo">
                                /lojas/{l.slug}
                              </Link>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-tinta font-semibold">
                              {l.dono_nome} {l.matricula_validada && <span title="Matrícula verificada"><ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" /></span>}
                            </div>
                            <div className="text-xs text-tinta-suave">{l.dono_email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-tinta-suave">
                            {l.produtos_ativos} ativos / {l.total_produtos}
                            {l.produtos_vendidos > 0 && <div>{l.produtos_vendidos} vendidos</div>}
                          </td>
                          <td className="py-3.5 px-4 text-tinta-suave">{l.total_interesses}</td>
                          <td className="py-3.5 px-4">{badgeLoja(l.status)}</td>
                          <td className="py-3.5 px-4 text-right">
                            <select
                              value={l.status}
                              aria-label={`Status de ${l.nome}`}
                              disabled={processando === `loja-${l.id}`}
                              onChange={(e) => handleStatusLoja(l, e.target.value as LojaStatus)}
                              className="text-xs px-3 py-1.5 rounded-pill border border-borda-controle text-tinta bg-superficie disabled:opacity-50"
                            >
                              {STATUS_LOJA.map((s) => (
                                <option key={s.valor} value={s.valor}>{s.rotulo}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lojas.length === 0 && (
                  <p className="text-center text-xs text-tinta-suave py-10">Nenhuma loja encontrada com este filtro.</p>
                )}
              </div>
              <Paginacao
                pagina={paginaLojas.pagina}
                total={paginaLojas.total}
                porPagina={paginaLojas.por_pagina}
                rotulo="Páginas de perfis"
                hrefPagina={(n) => caminhoLojas({ ...estado, pagina: n })}
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {produtos.map((p) => (
                  <div key={p.id} className="bg-superficie border border-borda rounded-controle p-3 flex gap-3 hover:shadow-hover transition">
                    <div className="w-16 h-16 rounded-controle bg-pagina overflow-hidden flex-shrink-0">
                      {p.imagem_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagem_url} alt={p.nome} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl"><Package size={16} strokeWidth={1.75} aria-hidden="true" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-tinta truncate">{p.nome}</p>
                      <p className="text-xs text-tinta-suave truncate">{p.loja_nome}</p>
                      <p className="text-xs text-tinta mt-0.5">
                        {p.preco > 0 ? `R$ ${p.preco.toFixed(2).replace(".", ",")}` : "Troca"}
                        {p.status !== "ativo" && <span className="ml-2 text-xs text-tinta-suave">({p.status})</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={processando === `produto-${p.id}`}
                      onClick={() => handleDestaque(p)}
                      title={p.destaque ? "Remover dos destaques" : "Impulsionar na home"}
                      aria-pressed={p.destaque}
                      className={`self-center text-sm font-semibold px-3 min-h-[44px] inline-flex items-center gap-1.5 rounded-controle border transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 ${
                        p.destaque
                          ? "bg-acao-50 border-acao-hover text-acao-hover"
                          : "bg-superficie border-borda-controle text-petroleo hover:border-petroleo"
                      }`}
                    >
                      <Star size={16} strokeWidth={1.75} className={p.destaque ? "fill-acao-hover" : ""} aria-hidden="true" />
                      {p.destaque ? "Impulsionado" : "Impulsionar"}
                    </button>
                  </div>
                ))}
                {produtos.length === 0 && (
                  <p className="col-span-full text-center text-xs text-tinta-suave py-10">Nenhum produto encontrado.</p>
                )}
              </div>
              <Paginacao
                pagina={paginaProdutos.pagina}
                total={paginaProdutos.total}
                porPagina={paginaProdutos.por_pagina}
                rotulo="Páginas de anúncios"
                hrefPagina={(n) => caminhoLojas({ ...estado, pagina: n })}
              />
            </>
          )}
        </div>
      </div>
      {modalConfirmacao}
    </>
  );
}
