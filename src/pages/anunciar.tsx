import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { createServerClient } from "@/lib/supabase";
import { urlLogin } from "@/lib/avisos-login";
import { LIMITES_TEXTO } from "@/lib/validacoes";
import {
  atualizarProduto,
  criarProduto,
  deletarProduto,
  getCategoriasArvore,
  getMeuProduto,
  getMeuUsuario,
  getMinhaLoja,
  updateLoja,
} from "@/lib/queries";
import { uploadImagemProduto, validarArquivo } from "@/lib/storage";
import { iconeParaCategoria } from "@/lib/icones-categoria";
import { modalidadeDoAnuncio, montarDescricao, separarDescricao } from "@/lib/anuncios";
import type { CategoriaComFilhos, Loja, Produto } from "@/types";
import {
  ArrowLeftRight,
  Camera,
  Check,
  ChevronLeft,
  CornerDownRight,
  ImagePlus,
  Plus,
  Repeat,
  Send,
  MessageCircle,
  ShoppingBag,
  TriangleAlert,
  X,
} from "lucide-react";

interface Props {
  loja: Loja;
  categorias: CategoriaComFilhos[];
  produto: Produto | null;
}

// lojas.contato guarda DDI + DDD + número (opcional desde a migração 26: sem ele o contato é pelo chat)
function temWhatsapp(loja: Loja): boolean {
  return (loja.contato ?? "").length >= 12;
}

const LOCAIS_SUGERIDOS = [
  "RU Central",
  "Biblioteca Universitária",
  "Centro de Vivência",
  "Centro Acadêmico (CA)",
  "Entrada Principal do Campus",
  "Bloco de Aulas",
];

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const serverSupabase = createServerClient(ctx);
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  // Modo de pré-visualização para testes de UI
  if (!user && (process.env.NODE_ENV === "development" && (ctx.query.preview === "1" || ctx.query.demo === "1"))) {
    const categorias = await getCategoriasArvore(serverSupabase);
    const mockLoja: Loja = {
      id: 1,
      usuario_id: 1,
      nome: "Estudante Demo",
      nome_exibicao: null,
      descricao: "Desapegando de livros e materiais no campus",
      contato: "(31) 99999-0000",
      whatsapp: "(31) 99999-0000",
      status: "ativo",
      criado_em: new Date().toISOString(),
      avatar_url: null,
      capa_url: null,
      slug: "estudante-demo",
      instagram_url: null,
      tiktok_url: null,
      locais_entrega: ["RU Central", "Biblioteca Universitária"],
      horarios: [],
    };
    return {
      props: {
        loja: mockLoja,
        categorias,
        produto: null,
      },
    };
  }

  if (!user) {
    return {
      redirect: {
        destination: urlLogin("anunciar"),
        permanent: false,
      },
    };
  }

  const editarId = typeof ctx.query.editar === "string" ? Number(ctx.query.editar) : NaN;

  try {
    // Editar não exige verificação (o anúncio pode estar pausado); publicar exige, também no banco
    let produto: Produto | null = null;
    if (Number.isInteger(editarId) && editarId > 0) {
      produto = await getMeuProduto(editarId, serverSupabase);
      if (!produto) {
        return { redirect: { destination: "/painel/anuncios", permanent: false } };
      }
    } else {
      const usuario = await getMeuUsuario(serverSupabase);
      if (!usuario?.matricula_validada) {
        return { redirect: { destination: "/onboarding", permanent: false } };
      }
    }

    const loja = await getMinhaLoja(serverSupabase);
    const categorias = await getCategoriasArvore(serverSupabase);

    return {
      props: {
        loja,
        categorias,
        produto,
      },
    };
  } catch (error) {
    console.error("Erro ao carregar/criar perfil de estudante:", error);
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
};

export default function AnunciarPage({ loja, categorias, produto }: Props) {
  const router = useRouter();
  const editando = produto !== null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Valores iniciais: vazio ao anunciar; dados do anúncio ao editar
  const inicial = separarDescricao(produto?.descricao ?? null);
  const categoriaInicial = produto ? String(produto.categoria_id) : "";
  const paiInicial = produto
    ? String(
        categorias.find((c) => String(c.id) === categoriaInicial || c.filhos.some((f) => String(f.id) === categoriaInicial))?.id ?? ""
      )
    : "";

  const [modalidade, setModalidade] = useState<"venda" | "troca" | "ambos">(
    produto ? modalidadeDoAnuncio(produto.preco, produto.aceita_troca) : "venda"
  );

  const [nome, setNome] = useState(produto?.nome ?? "");
  const [preco, setPreco] = useState(produto && produto.preco > 0 ? String(produto.preco) : "");
  const [itemTrocaDesejado, setItemTrocaDesejado] = useState(inicial.itemTroca);
  const [categoriaPaiId, setCategoriaPaiId] = useState(paiInicial);
  const [categoriaId, setCategoriaId] = useState(categoriaInicial !== paiInicial ? categoriaInicial : "");
  const [descricao, setDescricao] = useState(inicial.descricao);
  const [locaisSelecionados, setLocaisSelecionados] = useState<string[]>(
    loja.locais_entrega && loja.locais_entrega.length > 0
      ? loja.locais_entrega
      : ["RU Central", "Biblioteca Universitária"]
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(produto?.imagem_url ?? null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }

  function toggleLocal(local: string) {
    if (locaisSelecionados.includes(local)) {
      setLocaisSelecionados(locaisSelecionados.filter((l) => l !== local));
    } else {
      setLocaisSelecionados([...locaisSelecionados, local]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validações
    if (!nome.trim()) {
      setError("Por favor, informe o título do anúncio.");
      setLoading(false);
      return;
    }

    // Validação: precisa de categoria (pai ou sub)
    const catFinal = categoriaId || categoriaPaiId;
    if (!catFinal) {
      setError("Selecione uma categoria para o item.");
      setLoading(false);
      return;
    }

    let precoFinal = 0;
    if (modalidade === "venda" || modalidade === "ambos") {
      const parsed = parseFloat(preco.replace(",", "."));
      if (isNaN(parsed) || parsed <= 0) {
        setError("Informe um preço maior que zero. Para anunciar sem preço, escolha Trocar.");
        setLoading(false);
        return;
      }
      precoFinal = parsed;
    }

    // Valida a foto antes de gravar qualquer coisa
    if (imageFile) {
      try {
        validarArquivo(imageFile);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
        return;
      }
    }

    const dados = {
      nome: nome.trim(),
      descricao: montarDescricao(descricao, modalidade === "venda" ? "" : itemTrocaDesejado),
      preco: precoFinal,
      categoria_id: parseInt(categoriaId || categoriaPaiId),
      aceita_troca: modalidade === "troca" || modalidade === "ambos",
    };

    try {
      if (editando) {
        await atualizarProduto(produto.id, dados);
        if (imageFile) await uploadImagemProduto(produto.id, imageFile);
      } else {
        const novo = await criarProduto({ loja_id: loja.id, ...dados });
        if (imageFile) {
          try {
            await uploadImagemProduto(novo.id, imageFile);
          } catch (uploadErr) {
            // Sem a foto o anúncio não fica pela metade: desfaz e deixa tentar de novo
            await deletarProduto(novo.id).catch(() => undefined);
            throw uploadErr;
          }
        }
      }

      // Atualiza os locais habituais de entrega do perfil
      if (locaisSelecionados.length > 0) {
        await updateLoja(loja.id, { locais_entrega: locaisSelecionados });
      }

      router.push(editando ? "/painel/anuncios" : "/painel/anuncios?sucesso=1");
    } catch (err) {
      console.error("Erro ao cadastrar anúncio:", err);
      setError((err as { message?: string })?.message || "Ocorreu um erro ao publicar seu anúncio. Tente novamente.");
      setLoading(false);
    }
  }

  const MODOS = [
    { id: "venda" as const, rotulo: "Vender", descricao: "Defina um preço.", Icone: ShoppingBag, ativa: "bg-petroleo border-petroleo" },
    { id: "troca" as const, rotulo: "Trocar", descricao: "Troque por outro item.", Icone: Repeat, ativa: "bg-troca border-troca" },
    { id: "ambos" as const, rotulo: "Vender ou trocar", descricao: "Aceite dinheiro ou troca.", Icone: ArrowLeftRight, ativa: "bg-petroleo border-petroleo" },
  ];

  return (
    <>
      <Head>
        <title>{editando ? "Editar anúncio • Circular" : "Anunciar • Circular"}</title>
      </Head>

      <div className="min-h-screen bg-pagina py-8 sm:py-12">
        <div className="max-w-2xl mx-auto px-4">
          {/* Navegação superior */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/painel"
              className="text-sm font-semibold text-petroleo hover:underline flex items-center gap-1 min-h-[44px] rounded-controle focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
            >
              <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
              Voltar ao painel
            </Link>
          </div>

          <div className="bg-superficie border border-borda rounded-card p-6 sm:p-8">
            {/* Cabeçalho */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-petroleo tracking-tight">
                {editando ? "Editar anúncio" : "Anunciar item"}
              </h1>
              <p className="text-tinta-suave text-sm mt-1">
                Livros, materiais de curso ou serviços para outros alunos do seu campus.
              </p>
            </div>

            {!editando && !temWhatsapp(loja) && (
              <div role="status" className="mb-6 p-4 bg-petroleo-50 text-petroleo text-sm rounded-card flex items-start gap-3">
                <MessageCircle size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                <p>
                  Os colegas vão falar com você pelo chat do Circular. Se preferir receber também pelo WhatsApp,
                  cadastre o número no{" "}
                  <Link href="/painel/perfil" className="font-semibold underline">
                    seu perfil
                  </Link>
                  .
                </p>
              </div>
            )}

            {error && (
              <div role="alert" className="mb-6 p-4 bg-perigo-50 text-perigo text-sm rounded-card flex items-start gap-3">
                <TriangleAlert size={20} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Modo do anúncio */}
              <fieldset>
                <legend className="block text-sm font-semibold text-tinta mb-2">
                  O que você quer fazer com este item?
                </legend>
                <div role="tablist" aria-label="Modo do anúncio" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {MODOS.map(({ id, rotulo, descricao, Icone, ativa }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={modalidade === id}
                      onClick={() => setModalidade(id)}
                      className={`p-3.5 min-h-[44px] rounded-controle border text-left transition flex items-start gap-2.5 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 ${
                        modalidade === id ? `${ativa} text-white` : "border-borda-controle bg-superficie text-tinta hover:border-petroleo"
                      }`}
                    >
                      <Icone size={20} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <span className="block font-semibold text-sm">{rotulo}</span>
                        <span className={`block text-xs mt-0.5 ${modalidade === id ? "text-white" : "text-tinta-suave"}`}>
                          {descricao}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* 2. CAMPOS DE VALOR E TROCA CONDICIONAIS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-pagina border border-borda rounded-card p-4">
                {/* Preço em R$ */}
                <div>
                  <label className="block text-sm font-semibold text-tinta mb-1">
                    Preço (R$) {modalidade !== "troca" && "*"}
                  </label>
                  {modalidade === "troca" ? (
                    <div className="min-h-[44px] flex items-center px-3 rounded-controle border border-borda bg-pagina text-tinta-suave text-sm font-semibold">
                      <span>Sem preço (só troca)</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-sutil text-sm font-bold">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={preco}
                        onChange={(e) => setPreco(e.target.value)}
                        placeholder="Ex: 45.00"
                        className="w-full pl-9 pr-3 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm font-semibold bg-superficie"
                      />
                    </div>
                  )}
                </div>

                {/* O que busca em troca */}
                <div>
                  <label className="block text-sm font-semibold text-tinta mb-1">
                    {modalidade === "troca"
                      ? "O que você busca em troca? *"
                      : "Aceita trocar por quê? (opcional)"}
                  </label>
                  <input
                    type="text"
                    required={modalidade === "troca"}
                    value={itemTrocaDesejado}
                    maxLength={LIMITES_TEXTO.itemTroca}
                    onChange={(e) => setItemTrocaDesejado(e.target.value)}
                    placeholder="Ex: Livro de Física 1, mouse ou jaleco"
                    className="w-full px-3 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-xs sm:text-sm bg-superficie"
                  />
                </div>
              </div>

              {/* 3. TÍTULO DO PRODUTO */}
              <div>
                <label className="block text-sm font-semibold text-tinta mb-1">
                  Título do anúncio *
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  maxLength={LIMITES_TEXTO.produtoNome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Livro Cálculo James Stewart Vol. 1 (8ª Ed.)"
                  className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie"
                />
              </div>

              {/* 4. CATEGORIA — seletor em cascata de 2 níveis */}
              <div>
                <label className="block text-sm font-semibold text-tinta mb-2">
                  Categoria *
                </label>

                {/* Nível 1: Categoria pai */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                  {categorias.map((pai) => (
                    <button
                      key={pai.id}
                      type="button"
                      onClick={() => {
                        setCategoriaPaiId(String(pai.id));
                        setCategoriaId(""); // reset subcategoria
                      }}
                      aria-pressed={categoriaPaiId === String(pai.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-controle border text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 ${
                        categoriaPaiId === String(pai.id)
                          ? "border-petroleo bg-petroleo-50 text-petroleo"
                          : "border-borda-controle bg-superficie text-tinta hover:border-petroleo"
                      }`}
                    >
                      {(() => {
                        const Icone = iconeParaCategoria(pai.nome);
                        return <Icone size={18} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />;
                      })()}
                      <span className="leading-tight text-sm">{pai.nome}</span>
                    </button>
                  ))}
                </div>

                {/* Nível 2: Subcategorias (se existirem) */}
                {categoriaPaiId && (() => {
                  const pai = categorias.find((c) => String(c.id) === categoriaPaiId);
                  if (!pai || !pai.filhos || pai.filhos.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs font-semibold text-tinta-suave mb-2 flex items-center gap-1.5">
                        <CornerDownRight size={16} strokeWidth={1.75} aria-hidden="true" />
                        <span>Subcategoria de {pai.nome}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pai.filhos.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setCategoriaId(String(sub.id))}
                            aria-pressed={categoriaId === String(sub.id)}
                            className={`flex items-center gap-1.5 px-4 min-h-[44px] rounded-pill border text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 ${
                              categoriaId === String(sub.id)
                                ? "border-petroleo bg-petroleo text-white"
                                : "border-borda-controle bg-superficie text-tinta hover:border-petroleo"
                            }`}
                          >
                            {sub.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 5. DESCRIÇÃO */}
              <div>
                <label className="block text-sm font-semibold text-tinta mb-1">
                  Descrição
                </label>
                <textarea
                  rows={4}
                  value={descricao}
                  maxLength={LIMITES_TEXTO.produtoDescricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o estado de conservação, marcas de uso, edição ou motivo do desapego..."
                  className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie resize-y"
                />
              </div>

              {/* 6. UPLOAD DE FOTO */}
              <div>
                <label className="block text-sm font-semibold text-tinta mb-1">
                  Foto do item
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {imagePreview ? (
                    <div className="relative w-32 h-32 rounded-card overflow-hidden border-2 border-borda shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      {imageFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(produto?.imagem_url ?? null);
                        }}
                        aria-label="Remover foto"
                        className="absolute top-1 right-1 w-11 h-11 rounded-pill bg-superficie/90 border border-borda text-perigo flex items-center justify-center focus-visible:outline-2 focus-visible:outline-petroleo"
                      >
                        <X size={18} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-card border-2 border-dashed border-borda-controle flex flex-col items-center justify-center text-tinta-sutil bg-pagina shrink-0">
                      <Camera size={28} strokeWidth={1.75} className="mb-1" aria-hidden="true" />
                      <span className="text-xs font-semibold">Sem foto</span>
                    </div>
                  )}

                  <div className="flex-1 w-full">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle hover:border-petroleo bg-superficie font-semibold text-sm text-petroleo cursor-pointer transition">
                      <ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
                      <span>{imagePreview ? "Trocar imagem" : "Escolher foto do produto"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-tinta-sutil mt-1.5">
                      Formatos aceitos: JPG, PNG ou WebP. Tamanho máximo: 3 MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* 7. LOCAIS DE ENCONTRO NO CAMPUS */}
              <div>
                <label className="block text-sm font-semibold text-tinta mb-1">
                  Locais de entrega no campus
                </label>
                <p className="text-xs text-tinta-suave mb-2.5">
                  Escolha onde é mais prático encontrar o colega.
                </p>
                <div className="flex flex-wrap gap-2">
                  {LOCAIS_SUGERIDOS.map((local) => {
                    const ativo = locaisSelecionados.includes(local);
                    return (
                      <button
                        key={local}
                        type="button"
                        onClick={() => toggleLocal(local)}
                        aria-pressed={ativo}
                        className={`text-sm px-4 min-h-[44px] rounded-pill border transition flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 ${
                          ativo
                            ? "bg-petroleo border-petroleo text-white font-semibold"
                            : "bg-superficie border-borda-controle text-tinta-suave hover:border-petroleo"
                        }`}
                      >
                        {ativo ? (
                          <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                        )}
                        {local}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div className="pt-4 border-t border-borda flex items-center justify-end gap-3">
                <Link
                  href="/painel"
                  className="px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-controle border border-borda-controle bg-superficie text-petroleo text-sm font-semibold hover:border-petroleo transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                >
                  Cancelar
                </Link>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-acao hover:bg-acao-hover text-white text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-pill animate-spin" />
                      <span>{editando ? "Salvando…" : "Publicando…"}</span>
                    </>
                  ) : (
                    <>
                      <span>{editando ? "Salvar alterações" : "Publicar anúncio"}</span>
                      <Send size={16} strokeWidth={1.75} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
