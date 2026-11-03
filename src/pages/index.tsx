import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useRef } from "react";
import CardProduto from "@/components/CardProduto";
import HeroSection from "@/components/HeroSection";
import SecaoTrocas from "@/components/SecaoTrocas";
import { liberarCacheVisitante } from "@/lib/cache";
import { createServerClient } from "@/lib/supabase";
import { getCategorias, getMeusFavoritosIds, getProdutosFiltrados, getResumoUsuarioNavbar } from "@/lib/queries";
import type { Categoria, ProdutoListagem } from "@/types";
import { ChevronLeft, ChevronRight, GraduationCap, MailCheck, ShieldCheck, ShoppingBag } from "lucide-react";

interface Props {
  produtos: ProdutoListagem[];
  produtosTroca: ProdutoListagem[];
  categorias: Categoria[];
  logado: boolean;
  campusNome: string | null;
  favoritos: number[];
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const supabase = createServerClient(ctx);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Visitante não vê catálogo (migração 19): só a apresentação
  if (!user) {
    // HTML de visitante é igual para todos: sem no-store (libera o "voltar" instantâneo)
    liberarCacheVisitante(ctx);
    return {
      props: {
        produtos: [],
        produtosTroca: [],
        categorias: [], // a barra de categorias só aparece para logado
        logado: false,
        campusNome: null,
        favoritos: [],
      },
    };
  }

  const resumo = await getResumoUsuarioNavbar(supabase).catch(() => null);
  const campus_id = resumo?.instituicoes_id ?? undefined;

  const [categorias, produtos, produtosTroca, favoritos] = await Promise.all([
    getCategorias(supabase).catch(() => []),
    getProdutosFiltrados({ apenasDestaque: true, ...(campus_id && { campus_id }) }, supabase).catch(() => []),
    getProdutosFiltrados({ ordenar: "recentes", apenasTroca: true, ...(campus_id && { campus_id }) }, supabase).catch(
      () => []
    ),
    getMeusFavoritosIds(supabase).catch(() => []),
  ]);

  return {
    props: {
      produtos,
      produtosTroca,
      categorias,
      logado: true,
      campusNome: resumo?.instituicao_nome ?? null,
      favoritos,
    },
  };
};

const PASSOS = [
  {
    Icone: MailCheck,
    titulo: "Cadastre-se com o e-mail da faculdade",
    texto: "O domínio do seu e-mail define o seu campus. Nada de escolher: você entra direto na sua faculdade.",
  },
  {
    Icone: GraduationCap,
    titulo: "Veja só quem estuda com você",
    texto: "O catálogo mostra os anúncios dos colegas do seu campus, com encontro nos lugares que você já frequenta.",
  },
  {
    Icone: ShieldCheck,
    titulo: "Negocie com aluno verificado",
    texto: "Só alunos com matrícula confirmada anunciam. O contato é pelo WhatsApp, direto com o colega.",
  },
];

function ApresentacaoVisitante() {
  return (
    <section className="py-10">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-petroleo text-xl sm:text-2xl font-bold tracking-tight">Como funciona</h2>
        <ol className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {PASSOS.map(({ Icone, titulo, texto }) => (
            <li key={titulo} className="bg-superficie border border-borda rounded-card p-5">
              <Icone size={20} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
              <h3 className="text-tinta font-semibold mt-3">{titulo}</h3>
              <p className="text-tinta-suave text-sm mt-1 leading-relaxed">{texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/cadastro"
            className="w-full sm:w-auto bg-acao text-white rounded-controle hover:bg-acao-hover transition px-5 py-2.5 min-h-[44px] inline-flex items-center justify-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
          >
            Criar conta com e-mail da faculdade
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle transition px-5 py-2.5 min-h-[44px] inline-flex items-center justify-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
          >
            Já tenho conta
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home({ produtos, produtosTroca, categorias, logado, campusNome, favoritos }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rolarProdutos = (direcao: "esq" | "dir") => {
    if (scrollRef.current) {
      const scrollAmount = direcao === "dir" ? 360 : -360;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  if (!logado) {
    return (
      <>
        <HeroSection categorias={categorias} logado={false} />
        <ApresentacaoVisitante />
      </>
    );
  }

  return (
    <>
      <HeroSection categorias={categorias} logado={logado} />

      <section id="produtos" className="py-8 scroll-mt-32">
        <header className="max-w-6xl mx-auto px-4 mb-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-petroleo text-xl sm:text-2xl font-bold tracking-tight">
                {campusNome ? `Impulsionados no campus ${campusNome}` : "Impulsionados no seu campus"}
              </h2>
              <p className="text-tinta-suave text-sm mt-0.5">
                Anúncios em destaque de alunos verificados.
              </p>
            </div>
            <Link
              href="/listagem"
              className="text-petroleo text-sm font-semibold hover:underline hidden sm:inline-block"
            >
              Ver todos
            </Link>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 relative">
          {produtos.length === 0 ? (
            <div className="text-center py-16 bg-superficie border border-borda rounded-card p-6">
              <ShoppingBag size={40} strokeWidth={1.75} className="mx-auto text-petroleo" aria-hidden="true" />
              <p className="text-tinta font-semibold mt-3">
                Ainda não há anúncios em destaque no seu campus.
              </p>
              <p className="text-tinta-suave text-sm mt-1">
                Enquanto isso, veja todos os anúncios ou publique o seu.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href={logado ? "/anunciar" : "/cadastro"}
                  className="bg-acao text-white rounded-controle hover:bg-acao-hover transition px-4 py-2.5 min-h-[44px] inline-flex items-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                >
                  Anunciar item
                </Link>
                <Link
                  href="/listagem"
                  className="bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle transition px-5 py-2 text-sm font-semibold"
                >
                  Explorar catálogo
                </Link>
              </div>
            </div>
          ) : (
            <div className="relative group">
              {/* Seta circular para rolar horizontalmente à esquerda */}
              <button
                type="button"
                onClick={() => rolarProdutos("esq")}
                aria-label="Rolar produtos para a esquerda"
                className="absolute -left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-superficie shadow-flutuante border border-borda flex items-center justify-center text-petroleo z-20 transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
              >
                <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>

              {/* Seta circular para rolar horizontalmente à direita (como na imagem) */}
              <button
                type="button"
                onClick={() => rolarProdutos("dir")}
                aria-label="Rolar produtos para a direita"
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-pill bg-superficie shadow-flutuante border border-borda flex items-center justify-center text-petroleo z-20 transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
              >
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>

              {/* Linha horizontal com os cards de produtos com scroll suave */}
              <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1 snap-x snap-mandatory"
              >
                {produtos.map((produto) => (
                  <CardProduto
                    key={produto.id}
                    produto={produto}
                    largura="fixa"
                    favoritado={favoritos.includes(produto.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <Link
              href="/listagem"
              className="bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle transition px-4 py-2.5 min-h-[44px] inline-flex items-center font-semibold text-sm focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
            >
              Ver todos os anúncios
            </Link>
          </div>
        </div>
      </section>

      {/* Seção dedicada: Feira de Trocas Universitária */}
      <SecaoTrocas
        produtos={produtosTroca}
        favoritos={favoritos}
        logado={logado}
      />
    </>
  );
}
