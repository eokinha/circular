import { useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { GraduationCap } from "lucide-react";
import AjudaEmailFaculdade from "@/components/AjudaEmailFaculdade";
import ConfiraEmail from "@/components/ConfiraEmail";
import Logo from "@/components/Logo";
import { liberarCacheVisitante } from "@/lib/cache";
import { createServerClient, supabase } from "@/lib/supabase";
import { getInstituicoes } from "@/lib/queries";
import { MENSAGEM_SENHA_VAZADA, senhaVazada } from "@/lib/senha-vazada";
import {
  DICA_SENHA,
  instituicaoDoEmail,
  LIMITES_TEXTO,
  problemaSenha,
  SENHA_TAMANHO_MINIMO,
  validarEmail,
} from "@/lib/validacoes";
import type { Instituicao } from "@/types";

interface Props {
  instituicoes: Instituicao[];
}

// Domínios das faculdades participantes: o campus do aluno sai do e-mail (o banco confere de novo no signup)
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const instituicoes = await getInstituicoes(createServerClient(ctx));
  // Lista pública de faculdades: o Cloudflare pode guardar (depois da consulta: página de erro não entra no cache)
  liberarCacheVisitante(ctx);
  return { props: { instituicoes: instituicoes.filter((i) => (i.dominios ?? []).length > 0) } };
};

const MENSAGEM_FACULDADE_FORA =
  "Sua faculdade ainda não está no Circular. Use o e-mail institucional de uma das faculdades participantes.";

export default function CadastroPage({ instituicoes }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarAjudaEmail, setMostrarAjudaEmail] = useState(false);
  // E-mail para o qual o link de confirmação foi enviado; troca o formulário pela tela "Confira seu e-mail"
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    sobrenome: "",
  });

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validações básicas
    if (!validarEmail(formData.email)) {
      setError("Por favor, insira um e-mail válido.");
      setLoading(false);
      return;
    }

    if (!instituicaoDoEmail(formData.email, instituicoes)) {
      setError(MENSAGEM_FACULDADE_FORA);
      setLoading(false);
      return;
    }

    const erroSenha = problemaSenha(formData.password);
    if (erroSenha) {
      setError(erroSenha);
      setLoading(false);
      return;
    }

    if (await senhaVazada(formData.password)) {
      setError(MENSAGEM_SENHA_VAZADA);
      setLoading(false);
      return;
    }

    const { password, nome, sobrenome } = formData;
    const email = formData.email.trim();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // O template usa {{ .SiteURL }}/confirmar-email (db/emails); isto só vale como fallback do Supabase
        emailRedirectTo: `${window.location.origin}/confirmar-email`,
        data: {
          nome,
          sobrenome,
          termos_aceitos: aceitouTermos,
          // Outros campos serão preenchidos no onboarding
        },
      },
    });

    if (signUpError) {
      console.error("Erro no cadastro:", signUpError);
      
      let errorMessage = "Ocorreu um erro ao realizar o cadastro.";
      
      if (signUpError.message.includes("already registered")) {
        errorMessage = "Este e-mail já está cadastrado. Tente entrar na sua conta.";
      } else if (signUpError.code === "weak_password" || signUpError.message.includes("weak")) {
        errorMessage = `A senha escolhida é muito fraca ou já apareceu em vazamentos. ${DICA_SENHA}`;
      } else if (signUpError.message.toLowerCase().includes("database error")) {
        // handle_new_user recusa domínio fora de instituicoes.dominios
        errorMessage = MENSAGEM_FACULDADE_FORA;
      } else if (signUpError.message.toLowerCase().includes("email address") && signUpError.message.toLowerCase().includes("invalid")) {
        errorMessage = "O e-mail informado parece ser inválido ou não é aceito pelo sistema.";
      }

      setError(errorMessage);
      setLoading(false);
    } else if (data.user && (data.user.identities ?? []).length === 0) {
      // Com confirmação de e-mail ligada, o Supabase responde "sucesso" sem enviar nada para e-mail já confirmado
      setError("Este e-mail já está cadastrado. Tente entrar na sua conta.");
      setLoading(false);
    } else {
      setEnviadoPara(email);
      setLoading(false);
    }
  }

  async function handleReenviar() {
    if (!enviadoPara) return;
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: enviadoPara,
      options: { emailRedirectTo: `${window.location.origin}/confirmar-email` },
    });
    if (resendError) throw resendError;
  }

  const campusDoEmail = instituicaoDoEmail(formData.email, instituicoes);

  const inputClass = "w-full px-4 py-2 border border-borda-controle rounded-controle focus:ring-2 focus:ring-petroleo focus:border-transparent outline-none transition";

  if (enviadoPara) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-superficie p-8 rounded-card border border-borda">
          <h1 className="sr-only">Cadastro enviado</h1>
          <ConfiraEmail
            email={enviadoPara}
            motivo="cadastro"
            onReenviar={handleReenviar}
            onCorrigirEmail={() => {
              setEnviadoPara(null);
              setError(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-superficie p-8 rounded-card border border-borda">
        <div className="flex justify-center mb-4"><Logo variante="simbolo" /></div>
        <h1 className="text-2xl font-bold text-petroleo mb-6 text-center">Criar conta</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-perigo-50 text-perigo text-sm rounded-controle border border-perigo flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              Atenção
            </div>
            <p>{error}</p>
            {error === MENSAGEM_FACULDADE_FORA && instituicoes.length > 0 && (
              <ul className="text-tinta-suave space-y-0.5">
                {instituicoes.map((i) => (
                  <li key={i.id}>
                    <strong className="text-tinta">{i.nome}</strong>{" "}
                    <span className="break-all">{(i.dominios ?? []).map((d) => `@${d}`).join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}
            {error.includes("cadastrado") && (
              <Link href="/login" className="text-perigo font-bold hover:underline">
                Ir para o Login
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleCadastro} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-tinta mb-1">Nome</label>
              <input
                type="text"
                required
                maxLength={LIMITES_TEXTO.usuarioNome}
                className={inputClass}
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-tinta mb-1">Sobrenome</label>
              <input
                type="text"
                required
                maxLength={LIMITES_TEXTO.usuarioSobrenome}
                className={inputClass}
                value={formData.sobrenome}
                onChange={(e) => setFormData({ ...formData, sobrenome: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email-cadastro" className="block text-sm font-semibold text-tinta mb-1">
              E-mail da faculdade
            </label>
            <input
              id="email-cadastro"
              type="email"
              required
              placeholder="voce@aluno.suafaculdade.br"
              aria-describedby="campus-email"
              className={inputClass}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <p id="campus-email" aria-live="polite" className="text-xs text-tinta-suave mt-1 flex items-center gap-1">
              {campusDoEmail ? (
                <>
                  <GraduationCap size={14} strokeWidth={1.75} className="text-petroleo shrink-0" aria-hidden="true" />
                  Seu campus: <strong className="text-petroleo">{campusDoEmail.nome}</strong>
                </>
              ) : (
                "O domínio do seu e-mail define o seu campus no Circular."
              )}
            </p>
            <button
              type="button"
              onClick={() => setMostrarAjudaEmail((v) => !v)}
              aria-expanded={mostrarAjudaEmail}
              aria-controls="ajuda-email-faculdade"
              className="text-xs text-petroleo font-semibold hover:underline min-h-[44px]"
            >
              {mostrarAjudaEmail ? "Esconder ajuda" : "Não sabe qual é o seu e-mail da faculdade?"}
            </button>
            {mostrarAjudaEmail && (
              <div id="ajuda-email-faculdade" className="p-4 bg-pagina rounded-controle border border-borda">
                <AjudaEmailFaculdade instituicoes={instituicoes} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-tinta mb-1">Senha</label>
            <input
              type="password"
              required
              minLength={SENHA_TAMANHO_MINIMO}
              autoComplete="new-password"
              aria-describedby="dica-senha"
              className={inputClass}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <p id="dica-senha" className="text-xs text-tinta-suave mt-1">{DICA_SENHA}</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-tinta-suave">
            <input
              type="checkbox"
              required
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-petroleo shrink-0"
            />
            <span>
              Li e aceito os{" "}
              <Link href="/termos" target="_blank" className="text-petroleo font-semibold hover:underline">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" target="_blank" className="text-petroleo font-semibold hover:underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !aceitouTermos}
            className="w-full bg-acao text-white font-semibold py-3 rounded-controle hover:bg-acao-hover transition disabled:opacity-50 mt-4"
          >
            {loading ? "Processando..." : "Finalizar Cadastro"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-tinta-suave">
          Já possui conta?{" "}
          <Link href="/login" className="text-petroleo font-semibold hover:underline transition">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
