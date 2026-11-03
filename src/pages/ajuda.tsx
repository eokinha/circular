import { useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { ChevronDown } from "lucide-react";
import AjudaEmailFaculdade from "@/components/AjudaEmailFaculdade";
import { liberarCacheVisitante } from "@/lib/cache";
import { createServerClient } from "@/lib/supabase";
import { getInstituicoes } from "@/lib/queries";
import { FAQ } from "@/lib/faq";
import type { Instituicao } from "@/types";

interface Props {
  instituicoes: Instituicao[];
}

// Página pública: o visitante precisa dela antes de conseguir se cadastrar
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const instituicoes = await getInstituicoes(createServerClient(ctx));
  // Lista pública de faculdades: sem no-store (depois da consulta: página de erro segue o padrão)
  liberarCacheVisitante(ctx);
  return { props: { instituicoes: instituicoes.filter((i) => (i.dominios ?? []).length > 0) } };
};

export default function AjudaPage({ instituicoes }: Props) {
  // Link direto (/ajuda#nao-chegou) abre a pergunta; o navegador não abre <details> sozinho pela âncora
  useEffect(() => {
    function abrirDaAncora() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const alvo = id ? document.getElementById(id) : null;
      if (alvo instanceof HTMLDetailsElement) {
        alvo.open = true;
        alvo.scrollIntoView({ block: "start" });
      }
    }
    abrirDaAncora();
    window.addEventListener("hashchange", abrirDaAncora);
    return () => window.removeEventListener("hashchange", abrirDaAncora);
  }, []);

  return (
    <>
      <Head>
        <title>Ajuda • Circular</title>
        <meta name="description" content="Dúvidas sobre cadastro, e-mail da faculdade, senha, compras e anúncios no Circular." />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-petroleo mb-2">Ajuda</h1>
        <p className="text-tinta-suave mb-6">Respostas rápidas sobre cadastro, e-mail da faculdade, compras e anúncios.</p>

        <nav aria-label="Seções da ajuda" className="flex flex-wrap gap-2 mb-10">
          {FAQ.map((secao) => (
            <a
              key={secao.id}
              href={`#${secao.id}`}
              className="rounded-pill border border-borda-controle bg-superficie text-petroleo text-sm font-semibold px-4 py-2 hover:border-petroleo min-h-[44px] inline-flex items-center focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
            >
              {secao.titulo}
            </a>
          ))}
        </nav>

        <div className="space-y-10">
          {FAQ.map((secao) => (
            <section key={secao.id} id={secao.id} aria-labelledby={`${secao.id}-titulo`} className="scroll-mt-24">
              <h2 id={`${secao.id}-titulo`} className="text-xl font-bold text-petroleo mb-4">
                {secao.titulo}
              </h2>
              <div className="bg-superficie border border-borda rounded-card divide-y divide-borda">
                {secao.perguntas.map((p) => (
                  <details key={p.id} id={p.id} className="group scroll-mt-24">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 min-h-[44px] font-semibold text-tinta hover:text-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 rounded-card [&::-webkit-details-marker]:hidden">
                      {p.pergunta}
                      <ChevronDown
                        size={20}
                        strokeWidth={1.75}
                        className="shrink-0 text-tinta-suave transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="px-5 pb-5 space-y-3 text-sm text-tinta-suave">
                      {p.resposta.map((paragrafo, i) => (
                        <p key={i}>{paragrafo}</p>
                      ))}
                      {p.guiaFaculdades && (
                        <div className="p-4 bg-pagina rounded-controle border border-borda">
                          <AjudaEmailFaculdade instituicoes={instituicoes} />
                        </div>
                      )}
                      {p.links && (
                        <p className="flex flex-wrap gap-x-4 gap-y-1">
                          {p.links.map((l) => (
                            <Link key={l.href} href={l.href} className="text-petroleo font-semibold hover:underline">
                              {l.texto}
                            </Link>
                          ))}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
