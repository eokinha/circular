import HorariosCampus from "@/components/HorariosCampus";
import { useCallback, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  Calendar,
  ChevronLeft,
  Eye,
  Heart,
  ImageOff,
  MapPin,
  PackageX,
  Pencil,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import AvisoFavorito, { type TipoAvisoFavorito } from "@/components/AvisoFavorito";
import BotaoCompartilhar from "@/components/BotaoCompartilhar";
import BotaoContato from "@/components/BotaoContato";
import BotaoConversar from "@/components/BotaoConversar";
import BotaoDenunciar from "@/components/BotaoDenunciar";
import CardProduto from "@/components/CardProduto";
import Estrelas, { formatarNota } from "@/components/Estrelas";
import SecaoPerguntas from "@/components/SecaoPerguntas";
import SeloVerificado from "@/components/SeloVerificado";
import { motivoForaDoAr } from "@/lib/anuncios";
import { caminhoAnuncio, idDoAnuncio } from "@/lib/compartilhar";
import { createServerClient } from "@/lib/supabase";
import {
  definirFavorito,
  getAnuncioLeitura,
  getAvaliacoesDoVendedor,
  getMeusFavoritosIds,
  getPerguntasDoAnuncio,
} from "@/lib/queries";
import type { AnuncioLeitura, PerguntaAnuncio } from "@/types";

interface Props {
  leitura: AnuncioLeitura;
  favoritos: number[]; // ids favoritados, para os cards de "Mais de {nome}"
  perguntas: PerguntaAnuncio[];
  notaVendedor: { media: number; total: number } | null;
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";

function formatarPreco(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

// /anuncio/{id}-{nome}: só o id identifica; nome diferente redireciona para o endereço certo
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = idDoAnuncio(ctx.params?.id);
  if (!id) return { notFound: true };

  const supabase = createServerClient(ctx);
  const [leitura, favoritos] = await Promise.all([
    getAnuncioLeitura(id, supabase),
    getMeusFavoritosIds(supabase).catch(() => []),
  ]);
  if (!leitura) return { notFound: true };

  const nome = leitura.estado === "ok" ? leitura.anuncio.nome : leitura.nome;
  const canonico = caminhoAnuncio(id, nome);
  if (`/anuncio/${ctx.params?.id}` !== canonico) {
    const busca = ctx.resolvedUrl.includes("?") ? ctx.resolvedUrl.slice(ctx.resolvedUrl.indexOf("?")) : "";
    return { redirect: { destination: canonico + busca, permanent: false } };
  }

  // Perguntas do anúncio e nota do vendedor (migração 24); se falhar, a página abre sem elas
  let perguntas: PerguntaAnuncio[] = [];
  let notaVendedor: Props["notaVendedor"] = null;
  if (leitura.estado === "ok") {
    const [lista, resumo] = await Promise.all([
      getPerguntasDoAnuncio(id, supabase).catch(() => []),
      getAvaliacoesDoVendedor(leitura.loja.id, supabase).catch(() => null),
    ]);
    perguntas = lista;
    if (resumo?.media != null && resumo.total > 0) notaVendedor = { media: resumo.media, total: resumo.total };
  }

  return { props: { leitura, favoritos, perguntas, notaVendedor } };
};

function AnuncioIndisponivel({ nome, loja }: { nome: string; loja: { slug: string | null; nome: string } | null }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <Head>
        <title>Anúncio indisponível • Circular</title>
      </Head>
      <div className="bg-superficie border border-borda rounded-card p-8 text-center">
        <PackageX size={40} strokeWidth={1.75} className="mx-auto text-petroleo" aria-hidden="true" />
        <h1 className="text-petroleo text-xl font-bold mt-3">Este anúncio não está mais disponível</h1>
        <p className="text-tinta-suave text-sm mt-2">
          &ldquo;{nome}&rdquo; foi vendido, pausado ou saiu do ar. Veja o que mais está anunciado.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {loja?.slug && (
            <Link
              href={`/perfil/${loja.slug}`}
              className={`bg-acao hover:bg-acao-hover text-white rounded-controle px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center text-sm font-semibold transition ${FOCO}`}
            >
              Ver o perfil de {loja.nome}
            </Link>
          )}
          <Link
            href="/listagem"
            className={`bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center text-sm font-semibold transition ${FOCO}`}
          >
            Ver anúncios do campus
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AnuncioPage({ leitura, favoritos, perguntas, notaVendedor }: Props) {
  const [favoritado, setFavoritado] = useState(leitura.estado === "ok" && leitura.favoritado);
  const [salvandoFavorito, setSalvandoFavorito] = useState(false);
  const [aviso, setAviso] = useState<TipoAvisoFavorito | null>(null);
  const [chaveAviso, setChaveAviso] = useState(0);
  const limparAviso = useCallback(() => setAviso(null), []);

  if (leitura.estado === "indisponivel") {
    return <AnuncioIndisponivel nome={leitura.nome} loja={leitura.loja} />;
  }

  const { anuncio, loja, outros, ehDono, mesmoCampus, disponivel, codigoCompartilhamento } = leitura;
  const soTroca = anuncio.preco === 0;
  const aceitaTroca = anuncio.aceita_troca || soTroca;
  const precoTexto = soTroca ? "Só troca" : formatarPreco(anuncio.preco);
  const podeInteragir = !ehDono && mesmoCampus && disponivel;

  // Muda na hora e grava no banco; se o banco recusar, volta ao estado anterior
  async function handleFavoritar() {
    const novo = !favoritado;
    setFavoritado(novo);
    setSalvandoFavorito(true);
    try {
      await definirFavorito(anuncio.id, novo);
      setAviso(novo ? "salvo" : "removido");
    } catch {
      setFavoritado(!novo);
      setAviso("erro");
    } finally {
      setSalvandoFavorito(false);
      setChaveAviso((c) => c + 1);
    }
  }

  return (
    <>
      <Head>
        <title>{`${anuncio.nome} • Circular`}</title>
        <meta name="description" content={`${precoTexto} · ${loja.nome} na Circular.`} />
      </Head>

      <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8 pb-16">
        <Link
          href={loja.slug ? `/perfil/${loja.slug}` : "/listagem"}
          className={`inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-petroleo hover:underline rounded-controle mb-2 ${FOCO}`}
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          {loja.slug ? `Perfil de ${loja.nome}` : "Voltar aos anúncios"}
        </Link>

        {ehDono && !disponivel && (
          <div role="status" className="mb-4 bg-doacao-50 text-doacao rounded-card p-4 text-sm">
            Seu anúncio está {motivoForaDoAr(anuncio.status, anuncio.renovado_em)}. Só você vê esta página até ele voltar
            ao ar.{" "}
            <Link href="/painel/anuncios" className="font-semibold underline">
              Gerenciar no painel
            </Link>
          </div>
        )}

        {!mesmoCampus && !ehDono && (
          <div role="status" className="mb-4 bg-petroleo-50 text-petroleo rounded-card p-4 flex items-start gap-3">
            <Eye size={20} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm">
              <strong>Anúncio de outro campus{loja.instituicao_nome ? ` (${loja.instituicao_nome})` : ""}.</strong>{" "}
              Você pode ver, mas o contato é só entre alunos da mesma faculdade.
            </p>
          </div>
        )}

        <article className="bg-superficie border border-borda rounded-card overflow-hidden grid grid-cols-1 md:grid-cols-2">
          <div className="aspect-square bg-pagina relative">
            {anuncio.imagem_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={anuncio.imagem_url} alt={anuncio.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-tinta-sutil">
                <ImageOff size={48} strokeWidth={1.75} aria-hidden="true" />
              </div>
            )}
            {podeInteragir && (
              <button
                type="button"
                onClick={handleFavoritar}
                disabled={salvandoFavorito}
                aria-label={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                aria-pressed={favoritado}
                className={`absolute top-3 right-3 w-11 h-11 rounded-pill bg-superficie/90 flex items-center justify-center text-tinta-suave hover:text-perigo transition disabled:opacity-60 ${FOCO}`}
              >
                <Heart
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={favoritado ? "fill-perigo text-perigo" : ""}
                />
              </button>
            )}
            <AvisoFavorito aviso={aviso} chave={chaveAviso} onSumir={limparAviso} />
          </div>

          <div className="p-6 sm:p-8 flex flex-col gap-5">
            <div>
              {anuncio.categoria_nome && (
                <span className="text-tinta-suave text-xs uppercase tracking-wide">{anuncio.categoria_nome}</span>
              )}
              <h1 className="text-petroleo text-2xl sm:text-3xl font-bold tracking-tight mt-1">{anuncio.nome}</h1>
              <p className="text-tinta text-2xl font-bold mt-3">{precoTexto}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aceitaTroca && (
                  <span className="inline-flex items-center gap-1 rounded-pill text-xs font-semibold px-2.5 py-1 bg-troca-50 text-troca-texto">
                    <Repeat size={14} strokeWidth={1.75} aria-hidden="true" />
                    Aceita troca
                  </span>
                )}
                {anuncio.destaque && (
                  <span className="rounded-pill text-xs font-semibold px-2.5 py-1 bg-acao-50 text-acao-hover">
                    Impulsionado
                  </span>
                )}
              </div>
            </div>

            {anuncio.descricao && (
              <p className="text-tinta text-sm leading-relaxed whitespace-pre-line">{anuncio.descricao}</p>
            )}

            <p className="text-tinta-suave text-xs flex items-center gap-1.5">
              <Calendar size={14} strokeWidth={1.75} aria-hidden="true" />
              Publicado em {formatarData(anuncio.criado_em)}
            </p>

            {/* O link cobre o quadro todo (after:inset-0); o selo fica fora dele, por cima, porque é um botão */}
            <div className="relative border border-borda rounded-card p-4 flex items-center gap-3 hover:border-petroleo transition has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-petroleo has-[a:focus-visible]:outline-offset-2">
              <span className="w-12 h-12 rounded-pill bg-petroleo-50 shrink-0 overflow-hidden">
                {loja.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={loja.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center font-bold text-petroleo">
                    {loja.nome.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={loja.slug ? `/perfil/${loja.slug}` : "/listagem"}
                    className="text-tinta font-semibold truncate outline-none after:absolute after:inset-0 after:rounded-card"
                  >
                    {loja.nome}
                  </Link>
                  {loja.verificada && <SeloVerificado />}
                </span>
                {notaVendedor && (
                  <span className="flex items-center gap-1.5 text-xs text-tinta-suave mt-0.5">
                    <Estrelas nota={notaVendedor.media} tamanho={14} />
                    {formatarNota(notaVendedor.media)} ({notaVendedor.total})
                  </span>
                )}
                {loja.instituicao_nome && (
                  <span className="block text-tinta-suave text-xs truncate">{loja.instituicao_nome}</span>
                )}
              </span>
            </div>

            <HorariosCampus horarios={loja.horarios} />

            {loja.locais_entrega.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-tinta-suave">Locais de encontro:</span>
                {loja.locais_entrega.map((local) => (
                  <span
                    key={local}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-petroleo-50 text-petroleo rounded-pill"
                  >
                    <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                    {local}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex flex-wrap md:flex-nowrap gap-3">
              {ehDono ? (
                <Link
                  href={`/anunciar?editar=${anuncio.id}`}
                  className={`flex-1 bg-acao hover:bg-acao-hover text-white rounded-controle px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center gap-2 text-sm font-semibold transition ${FOCO}`}
                >
                  <Pencil size={18} strokeWidth={1.75} aria-hidden="true" />
                  Editar anúncio
                </Link>
              ) : (
                podeInteragir && (
                  <>
                    {/* Chat sempre; WhatsApp só se o vendedor cadastrou o número */}
                    <BotaoConversar
                      produtoId={anuncio.id}
                      rotulo="Tenho interesse"
                      className={`w-full bg-acao hover:bg-acao-hover text-white rounded-controle px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center gap-2 text-sm font-semibold transition ${FOCO}`}
                    />
                    {leitura.temWhatsapp && (
                      <BotaoContato
                        lojaId={loja.id}
                        produtoId={anuncio.id}
                        mensagem={`Olá! Vi "${anuncio.nome}" na Circular e tenho interesse.`}
                        rotulo="WhatsApp"
                        className={`w-full bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle px-4 py-2.5 min-h-[44px] inline-flex items-center justify-center gap-2 text-sm font-semibold transition ${FOCO}`}
                      />
                    )}
                  </>
                )
              )}
              {disponivel && codigoCompartilhamento && (
                <BotaoCompartilhar
                  tipo="anuncio"
                  codigo={codigoCompartilhamento}
                  nomeLoja={loja.nome}
                  ehDono={ehDono}
                  anuncio={{ id: anuncio.id, nome: anuncio.nome, precoTexto, imagemUrl: anuncio.imagem_url }}
                />
              )}
            </div>

            {!ehDono && <BotaoDenunciar key={anuncio.id} lojaId={loja.id} produtoId={anuncio.id} />}
          </div>
        </article>

        <SecaoPerguntas
          key={anuncio.id}
          produtoId={anuncio.id}
          perguntasIniciais={perguntas}
          ehDono={ehDono}
          podePerguntar={podeInteragir}
        />

        {outros.length > 0 && (
          <section className="mt-10" aria-labelledby="mais-da-loja">
            <div className="flex items-baseline justify-between mb-4">
              <h2 id="mais-da-loja" className="text-petroleo text-xl font-bold">
                Mais de {loja.nome}
              </h2>
              {loja.slug && (
                <Link href={`/perfil/${loja.slug}`} className="text-petroleo text-sm font-semibold hover:underline">
                  Ver loja
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {outros.slice(0, 8).map((produto) => (
                <CardProduto
                  key={produto.id}
                  produto={produto}
                  largura="fluida"
                  favoritado={favoritos.includes(produto.id)}
                  podeFavoritar={mesmoCampus && !ehDono}
                />
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 bg-petroleo-50 rounded-card p-5 flex items-start gap-3 text-petroleo">
          <ShieldCheck size={22} strokeWidth={1.75} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-bold text-sm">Negocie com segurança</h2>
            <p className="text-sm mt-0.5">
              Combine o encontro em locais movimentados do campus e confira o item antes de fechar.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
