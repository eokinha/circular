import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { atualizarStatusProduto, deletarProduto, renovarProduto, updateLoja } from "@/lib/queries";
import { removerImagensProduto } from "@/lib/storage";
import { formatarPrazo, situacaoDaConta } from "@/lib/contas";
import type { PainelProps } from "@/lib/painel-data";
import { PAGINAS_PAINEL, type AbaPainel } from "@/lib/painel-routes";
import { useConfirmacao } from "@/components/ModalConfirmacao";
import SecaoAnuncios from "@/components/painel/SecaoAnuncios";
import SecaoFavoritos from "@/components/painel/SecaoFavoritos";
import SecaoPerfil from "@/components/painel/SecaoPerfil";
import SecaoSuporte from "@/components/painel/SecaoSuporte";
import type { ChamadoLeitura, ChamadoResumo, Loja, Produto, ProdutoListagem, ProdutoStatus, Usuario } from "@/types";
import {
  CircleCheck,
  Clock,
  Heart,
  Package,
  Plus,
  TriangleAlert,
  User,
  X,
} from "lucide-react";

export default function PainelEstudante({
  loja: lojaInicial,
  produtosIniciais,
  favoritosIniciais,
  userEmail,
  usuarioInicial,
  instituicoes,
  situacaoConta,
  abaAtiva,
  suporte,
}: PainelProps & {
  abaAtiva: AbaPainel;
  // Só em /painel/suporte (pages/painel/suporte.tsx)
  suporte?: { chamados: ChamadoResumo[]; chamadoAberto: ChamadoLeitura | null };
}) {
  const router = useRouter();

  const [loja, setLoja] = useState<Loja>(lojaInicial);
  const situacao = situacaoConta ? situacaoDaConta(situacaoConta.status, situacaoConta.bloqueado_ate) : "ativa";
  const [produtos, setProdutos] = useState<Produto[]>(produtosIniciais);
  const [favoritos, setFavoritos] = useState<ProdutoListagem[]>(favoritosIniciais);
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [reativandoPerfil, setReativandoPerfil] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { confirmar, modalConfirmacao } = useConfirmacao();
  const [matriculaStatus, setMatriculaStatus] = useState<Usuario["matricula_status"]>(
    usuarioInicial?.matricula_status || "pendente"
  );

  // Estado para Modal de detalhes de favorito

  // Estatísticas do estudante
  const totalProdutos = produtos.length;
  const produtosAtivos = produtos.filter((p) => p.status === "ativo");
  const produtosPausados = produtos.filter((p) => p.status === "pausado");

  async function handleStatus(produto: Produto, novoStatus: ProdutoStatus) {
    setErroAcao(null);
    try {
      await atualizarStatusProduto(produto.id, novoStatus);
      // Reativar conta como renovação (o banco grava a data)
      const renovado_em = novoStatus === "ativo" ? new Date().toISOString() : produto.renovado_em;
      setProdutos((prev) =>
        prev.map((p) => (p.id === produto.id ? { ...p, status: novoStatus, renovado_em } : p))
      );
    } catch (err) {
      setErroAcao((err as { message?: string })?.message || "Não foi possível atualizar o status do anúncio.");
    }
  }

  async function handleRenovar(produto: Produto) {
    setErroAcao(null);
    try {
      await renovarProduto(produto.id);
      setProdutos((prev) =>
        prev.map((p) => (p.id === produto.id ? { ...p, renovado_em: new Date().toISOString() } : p))
      );
    } catch (err) {
      setErroAcao((err as { message?: string })?.message || "Não foi possível renovar o anúncio.");
    }
  }

  // Excluir anúncio
  async function handleExcluir(produtoId: number) {
    const produto = produtos.find((p) => p.id === produtoId);
    const ok = await confirmar({
      titulo: "Excluir anúncio?",
      mensagem: `${produto ? `"${produto.nome}" sai` : "O anúncio sai"} do site com a foto e não dá para desfazer. Se quer só tirar do ar por um tempo, use Pausar.`,
      rotuloConfirmar: "Excluir anúncio",
      perigo: true,
    });
    if (!ok) return;

    setErroAcao(null);
    try {
      await removerImagensProduto(produtoId);
      await deletarProduto(produtoId);
      setProdutos((prev) => prev.filter((p) => p.id !== produtoId));
    } catch {
      setErroAcao("Não foi possível excluir o anúncio. Tente de novo.");
    }
  }

  // Perfil pausado (só o dono volta para ativo; reprovado é do admin)
  async function handleReativarPerfil() {
    setReativandoPerfil(true);
    setErroAcao(null);
    try {
      await updateLoja(loja.id, { status: "ativo" });
      setLoja((prev) => ({ ...prev, status: "ativo" }));
    } catch (err) {
      setErroAcao((err as { message?: string })?.message || "Não foi possível reativar o perfil.");
    } finally {
      setReativandoPerfil(false);
    }
  }

  // O card já desmarcou no banco: só tira da lista
  function handleFavoritoRemovido(produtoId: number) {
    setFavoritos((prev) => prev.filter((p) => p.id !== produtoId));
  }

  return (
    <>
      <Head>
        <title>{`${PAGINAS_PAINEL[abaAtiva].title} • Circular`}</title>
      </Head>

      <div className="min-h-screen bg-pagina pb-16">
        {/* Perfil fora do ar: sem isso o aluno não percebe que ninguém vê o perfil nem os anúncios */}
        {loja.status !== "ativo" && (
          <div role="status" className="bg-doacao-50 border-b border-borda">
            <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-tinta">
              <TriangleAlert size={18} strokeWidth={1.75} className="text-doacao shrink-0" aria-hidden="true" />
              <p className="flex-1">
                {loja.status === "pausado" ? (
                  <>
                    <strong className="font-semibold">Seu perfil está pausado.</strong> Os outros alunos não veem seu
                    perfil nem seus anúncios.
                  </>
                ) : situacao !== "ativa" && situacaoConta ? (
                  <>
                    <strong className="font-semibold">
                      {situacao === "suspensa" && situacaoConta.bloqueado_ate
                        ? `Sua conta está suspensa até ${formatarPrazo(situacaoConta.bloqueado_ate)}.`
                        : "Sua conta está bloqueada pela equipe do Circular."}
                    </strong>{" "}
                    {situacaoConta.moderacao_motivo && <>Motivo: {situacaoConta.moderacao_motivo}. </>}
                    {situacao === "suspensa"
                      ? "Até lá, ninguém vê seu perfil nem seus anúncios. Depois o perfil volta sozinho; os anúncios você reativa aqui. "
                      : "Ninguém vê seu perfil nem seus anúncios. "}
                    Se acha que é um engano,{" "}
                    <Link href={PAGINAS_PAINEL.suporte.href} className="text-petroleo font-semibold underline">
                      abra um chamado com a equipe
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    <strong className="font-semibold">Seu perfil está fora do ar pela moderação.</strong> Se acha que é
                    um engano,{" "}
                    <Link href={PAGINAS_PAINEL.suporte.href} className="text-petroleo font-semibold underline">
                      abra um chamado com a equipe
                    </Link>
                    .
                  </>
                )}
              </p>
              {loja.status === "pausado" && (
                <button
                  type="button"
                  onClick={handleReativarPerfil}
                  disabled={reativandoPerfil}
                  className="bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle transition px-4 py-2 min-h-[44px] text-sm font-semibold shrink-0 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                >
                  {reativandoPerfil ? "Reativando..." : "Reativar perfil"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cabeçalho do Painel */}
        <div className="bg-superficie border-b border-borda">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-pill bg-petroleo-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {loja.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={loja.avatar_url}
                        alt={loja.nome}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-petroleo">
                        {loja.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-petroleo tracking-tight">
                      {loja.nome}
                    </h1>
                    {matriculaStatus === "verificado" ? null : matriculaStatus === "pendente" ? (
                      <span className="inline-flex items-center gap-1 rounded-pill text-xs font-semibold px-2.5 py-1 bg-doacao-50 text-doacao">
                        <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                        Matrícula em análise
                      </span>
                    ) : (
                      <Link
                        href={PAGINAS_PAINEL.perfil.href}
                        className="inline-flex items-center gap-1 rounded-pill text-xs font-semibold px-2.5 py-1 bg-superficie border border-borda-controle hover:border-petroleo text-petroleo transition"
                      >
                        <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
                        Verifique sua matrícula
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão de Anunciar */}
              <div className="shrink-0 flex items-center gap-2">
                <Link
                  href="/anunciar"
                  className="w-full sm:w-auto bg-acao hover:bg-acao-hover text-white font-semibold text-sm px-4 py-2.5 min-h-[44px] rounded-controle transition flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                >
                  <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                  Novo anúncio
                </Link>
              </div>
            </div>

            {/* Páginas do Painel */}
            <nav
              aria-label="Seções do painel"
              className="mt-8 flex items-center gap-4 border-b border-borda overflow-x-auto no-scrollbar"
            >
              {Object.values(PAGINAS_PAINEL).map((pagina) => {
                const ativa = abaAtiva === pagina.id;
                const quantidade =
                  pagina.id === "anuncios"
                    ? totalProdutos
                    : pagina.id === "favoritos"
                      ? favoritos.length
                      : null;

                return (
                  <Link
                    key={pagina.id}
                    href={pagina.href}
                    aria-current={ativa ? "page" : undefined}
                    className={`pb-3 min-h-[44px] font-semibold text-sm transition flex items-center gap-2 border-b-2 shrink-0 ${
                      ativa
                        ? "border-petroleo text-petroleo"
                        : "border-transparent text-tinta-suave hover:text-tinta"
                    }`}
                  >
                    <pagina.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      {pagina.label}
                      {quantidade !== null ? ` (${quantidade})` : ""}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Notificação de sucesso ao cadastrar anúncio */}
        {abaAtiva === "anuncios" && router.query.sucesso && (
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <div role="status" className="p-4 bg-troca-50 text-troca-texto rounded-card flex items-center justify-between text-sm font-semibold">
              <div className="flex items-center gap-2">
                <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>Anúncio publicado com sucesso! Ele já está disponível no campus.</span>
              </div>
              <button
                type="button"
                onClick={() => router.replace(PAGINAS_PAINEL.anuncios.href, undefined, { shallow: true })}
                aria-label="Fechar aviso"
                className="ml-4 w-11 h-11 inline-flex items-center justify-center rounded-controle text-troca-texto focus-visible:outline-2 focus-visible:outline-petroleo"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8">
          {abaAtiva === "visao-geral" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-petroleo">Visão geral</h2>
                <p className="text-xs sm:text-sm text-tinta-suave mt-1">
                  Acompanhe sua conta e acesse rapidamente cada área do painel.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                  href={PAGINAS_PAINEL.anuncios.href}
                  className="bg-superficie border border-borda rounded-card p-5 transition hover:shadow-hover"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-tinta">Meus anúncios</span>
                    <Package size={20} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
                  </div>
                  <strong className="block text-3xl font-bold text-tinta mt-4">{totalProdutos}</strong>
                  <span className="text-xs text-tinta-suave mt-1 block">
                    {produtosAtivos.length} ativo{produtosAtivos.length === 1 ? "" : "s"} · {produtosPausados.length} pausado{produtosPausados.length === 1 ? "" : "s"}
                  </span>
                </Link>

                <Link
                  href={PAGINAS_PAINEL.favoritos.href}
                  className="bg-superficie border border-borda rounded-card p-5 transition hover:shadow-hover"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-tinta">Meus favoritos</span>
                    <Heart size={20} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
                  </div>
                  <strong className="block text-3xl font-bold text-tinta mt-4">{favoritos.length}</strong>
                  <span className="text-xs text-tinta-suave mt-1 block">itens salvos para ver depois</span>
                </Link>

                <Link
                  href={PAGINAS_PAINEL.perfil.href}
                  className="bg-superficie border border-borda rounded-card p-5 transition hover:shadow-hover"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-tinta">Meus dados</span>
                    <User size={20} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
                  </div>
                  <strong className="block text-lg font-bold text-tinta mt-4">
                    {matriculaStatus === "verificado"
                      ? "Perfil verificado"
                      : matriculaStatus === "pendente"
                        ? "Verificação em análise"
                        : "Verificação pendente"}
                  </strong>
                  <span className="text-xs text-tinta-suave mt-2 block">Nome, foto, capa, contato e e-mail da conta</span>
                </Link>
              </div>

              <div className="bg-superficie border border-borda rounded-card p-6 sm:p-8">
                <h3 className="text-base font-bold text-tinta">Ações rápidas</h3>
                <p className="text-xs text-tinta-suave mt-1">Atalhos para o que você mais usa.</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <Link
                    href="/anunciar"
                    className="inline-flex items-center justify-center gap-2 bg-acao hover:bg-acao-hover text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-controle transition"
                  >
                    <span>+ Publicar anúncio</span>
                  </Link>
                  <Link
                    href={PAGINAS_PAINEL.perfil.href}
                    className="inline-flex items-center justify-center gap-2 bg-superficie border border-borda-controle hover:bg-pagina text-tinta text-xs sm:text-sm font-bold px-5 py-2.5 rounded-controle transition"
                  >
                    <span>Editar perfil</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {erroAcao && (
            <div role="alert" className="mb-6 p-3 rounded-controle border border-perigo bg-perigo-50 text-perigo text-sm flex items-center gap-3">
              <p className="flex-1">{erroAcao}</p>
              <button
                type="button"
                onClick={() => setErroAcao(null)}
                aria-label="Fechar aviso"
                className="shrink-0 w-11 h-11 -my-2 flex items-center justify-center rounded-controle focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )}

          {abaAtiva === "anuncios" && (
            <SecaoAnuncios
              produtos={produtos}
              onStatus={handleStatus}
              onRenovar={handleRenovar}
              onExcluir={handleExcluir}
            />
          )}

          {abaAtiva === "favoritos" && (
            <SecaoFavoritos
              favoritos={favoritos}
              onRemovido={handleFavoritoRemovido}
            />
          )}

          {abaAtiva === "suporte" && suporte && (
            <SecaoSuporte
              chamados={suporte.chamados}
              chamadoAberto={suporte.chamadoAberto}
              contaRestrita={situacao !== "ativa"}
            />
          )}

          {abaAtiva === "perfil" && (
            <SecaoPerfil
              loja={loja}
              usuario={usuario}
              userEmail={userEmail}
              instituicoes={instituicoes}
              matriculaStatus={matriculaStatus}
              produtoIds={produtos.map((p) => p.id)}
              onLojaAtualizada={(alteracoes) => setLoja((prev) => ({ ...prev, ...alteracoes }))}
              onNomeAtualizado={(nome, sobrenome) => setUsuario((prev) => (prev ? { ...prev, nome, sobrenome } : prev))}
              onMatriculaStatus={setMatriculaStatus}
            />
          )}
        </div>
      </div>
      {modalConfirmacao}
    </>
  );
}
