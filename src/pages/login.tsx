import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Logo from "@/components/Logo";
import type { GetServerSideProps } from "next";
import { type AuthError } from "@supabase/supabase-js";
import { liberarCacheVisitante } from "@/lib/cache";
import { createServerClient, supabase } from "@/lib/supabase";
import { mensagemAvisoLogin } from "@/lib/avisos-login";
import Head from "next/head";
import { destinoCompartilhado } from "@/lib/compartilhar";
import { getResumoAnuncioCompartilhado, getResumoLojaCompartilhada, registrarAcesso } from "@/lib/queries";

// Prévia do link no WhatsApp (og:*): o WhatsApp segue o redirecionamento do middleware até aqui
interface Previa {
  titulo: string;
  descricao: string;
  imagem: string | null;
}

interface Props {
  avisoCompartilhado: string | null;
  previa: Previa | null;
}

function formatarPreco(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

// Chegou por um link compartilhado (?aviso=loja|anuncio&next=...?c={código}): mostra de quem é a loja
// ou qual é o anúncio. O texto vem do banco e só com o código certo; nada de texto livre da URL.
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // Sem dado de aluno (a prévia do link compartilhado é pública): o Cloudflare pode guardar
  liberarCacheVisitante(ctx);
  const alvo = destinoCompartilhado(ctx.query.next);
  const vazio = { props: { avisoCompartilhado: null, previa: null } };
  if (!alvo || ctx.query.aviso !== alvo.tipo) return vazio;
  const client = createServerClient(ctx);

  if (alvo.tipo === "loja") {
    const loja = await getResumoLojaCompartilhada(alvo.slug, alvo.codigo, client).catch(() => null);
    if (!loja) return vazio;
    const campus = loja.instituicao_nome ? `, do campus ${loja.instituicao_nome}` : "";
    return {
      props: {
        avisoCompartilhado: `Entre com o e-mail da sua faculdade para ver o perfil de ${loja.loja_nome}${campus}.`,
        previa: {
          titulo: `${loja.loja_nome} no Circular`,
          descricao: `Anúncios de alunos${campus ? ` do campus ${loja.instituicao_nome}` : " do campus"}. Deixa Circular.`,
          imagem: null,
        },
      },
    };
  }

  const anuncio = await getResumoAnuncioCompartilhado(alvo.id, alvo.codigo, client).catch(() => null);
  if (!anuncio) return vazio;
  const preco = anuncio.preco === 0 ? "Só troca" : formatarPreco(anuncio.preco) + (anuncio.aceita_troca ? " · aceita troca" : "");
  return {
    props: {
      avisoCompartilhado: `Entre com o e-mail da sua faculdade para ver "${anuncio.anuncio_nome}", de ${anuncio.loja_nome}.`,
      previa: {
        titulo: anuncio.anuncio_nome,
        descricao: `${preco} · ${anuncio.loja_nome}${anuncio.instituicao_nome ? `, ${anuncio.instituicao_nome}` : ""} · Circular`,
        imagem: anuncio.imagem_url,
      },
    },
  };
};

function mensagemErroLogin(erro: AuthError | Error): string {
  const code = "code" in erro ? String(erro.code ?? "") : "";
  const status = "status" in erro ? Number(erro.status) : undefined;
  const message = (erro.message ?? "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  ) {
    return "E-mail ou senha incorretos. Confira os dados ou cadastre-se se ainda não tiver conta.";
  }

  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Procure o link no e-mail da faculdade, inclusive no spam.";
  }

  if (code === "user_banned" || message.includes("banned")) {
    return "Esta conta está desativada. Entre em contato com o suporte.";
  }

  if (code === "over_request_rate_limit" || status === 429) {
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  }

  return "Não foi possível entrar. Tente novamente em instantes.";
}

export default function LoginPage({ avisoCompartilhado, previa }: Props) {
  const router = useRouter();
  const { aviso, next } = router.query;
  const msg = avisoCompartilhado ?? mensagemAvisoLogin(aviso);
  // Só caminhos internos: evita redirecionar para outro site depois do login
  const destino = typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const credenciaisInvalidas = Boolean(error?.includes("incorretos"));
  const emailNaoConfirmado = Boolean(error?.startsWith("Confirme seu e-mail"));
  const [reenvio, setReenvio] = useState<"enviando" | "enviado" | "erro" | null>(null);

  async function handleReenviarConfirmacao() {
    setReenvio("enviando");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: formData.email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/confirmar-email` },
    });
    setReenvio(resendError ? "erro" : "enviado");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReenvio(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (loginError) {
        setError(mensagemErroLogin(loginError));
        return;
      }

      // Registro de acesso (Marco Civil); falha aqui não impede o login
      await registrarAcesso().catch(() => undefined);
      await router.push(destino);
    } catch (err) {
      const fallback = err instanceof Error ? err : new Error("Erro inesperado no login");
      setError(mensagemErroLogin(fallback));
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-4 py-2 border border-borda-controle rounded-controle focus:ring-2 focus:ring-petroleo focus:border-transparent outline-none transition";

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      {previa && (
        <Head>
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="Circular" />
          <meta property="og:title" content={previa.titulo} />
          <meta property="og:description" content={previa.descricao} />
          {previa.imagem && <meta property="og:image" content={previa.imagem} />}
          <meta name="twitter:card" content={previa.imagem ? "summary_large_image" : "summary"} />
        </Head>
      )}
      <div className="bg-superficie p-8 rounded-card border border-borda">
        <div className="flex justify-center mb-4"><Logo variante="simbolo" /></div>
        <h1 className="text-2xl font-bold text-petroleo mb-6 text-center">Entrar</h1>

        {msg && (
          <div className="mb-4 p-3 bg-petroleo-50 text-petroleo text-sm rounded-controle border border-petroleo text-center">
            {msg}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 p-4 bg-perigo-50 text-perigo text-sm rounded-controle border border-perigo flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 font-semibold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              Não foi possível entrar
            </div>
            <p>{error}</p>
            {credenciaisInvalidas && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Link href="/esqueci-senha" className="text-perigo font-semibold hover:underline">
                  Esqueci minha senha
                </Link>
                <Link href="/cadastro" className="text-perigo font-semibold hover:underline">
                  Criar conta
                </Link>
              </div>
            )}
            {emailNaoConfirmado && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {reenvio === "enviado" ? (
                  <span role="status" className="text-tinta">Link reenviado. Confira o e-mail da faculdade.</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleReenviarConfirmacao}
                    disabled={reenvio === "enviando"}
                    className="text-perigo font-semibold hover:underline disabled:opacity-50"
                  >
                    {reenvio === "enviando" ? "Reenviando..." : "Reenviar link de confirmação"}
                  </button>
                )}
                <Link href="/ajuda#nao-chegou" className="text-perigo font-semibold hover:underline">
                  O e-mail não chegou
                </Link>
                {reenvio === "erro" && (
                  <span className="w-full">Não foi possível reenviar agora. Aguarde um minuto e tente de novo.</span>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-tinta mb-1">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              aria-invalid={credenciaisInvalidas}
              className={inputClass}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-semibold text-tinta">Senha</label>
              <Link href="/esqueci-senha" className="text-xs text-tinta-sutil hover:text-petroleo">
                Esqueceu a senha?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={credenciaisInvalidas}
              className={inputClass}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-acao text-white font-semibold py-3 rounded-controle hover:bg-acao-hover transition disabled:opacity-50 mt-4"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-tinta-suave">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-petroleo font-semibold hover:underline">
            Cadastre-se
          </Link>
        </p>
        <p className="mt-2 text-center text-sm">
          <Link href="/ajuda" className="text-tinta-sutil hover:text-petroleo hover:underline">
            Dúvidas? Veja a ajuda
          </Link>
        </p>
      </div>
    </div>
  );
}
