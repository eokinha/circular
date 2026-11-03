import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, LifeBuoy, Mail, Plus } from "lucide-react";
import ConversaSuporte from "@/components/suporte/ConversaSuporte";
import { horarioMensagem } from "@/lib/chat";
import { abrirChamado } from "@/lib/queries";
import {
  CATEGORIAS_CHAMADO,
  EMAIL_SUPORTE,
  LIMITES_CHAMADO,
  STATUS_CHAMADO,
  caminhoChamado,
  linkMailtoSuporte,
  problemaNovoChamado,
} from "@/lib/suporte";
import type { CategoriaChamado, ChamadoLeitura, ChamadoResumo } from "@/types";

interface Props {
  chamados: ChamadoResumo[];
  chamadoAberto: ChamadoLeitura | null; // ?chamado=<id>
  contaRestrita: boolean; // conta suspensa ou bloqueada: sugere o assunto "conta"
}

const FOCO = "focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2";
const CAMPO = `w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo bg-superficie text-sm text-tinta placeholder:text-tinta-sutil ${FOCO}`;

// Suporte do aluno em /painel/suporte: lista de chamados, formulário de novo chamado e a conversa com a equipe
export default function SecaoSuporte({ chamados, chamadoAberto, contaRestrita }: Props) {
  const router = useRouter();
  const emAndamento = chamados.filter((c) => c.status !== "resolvido").length;
  const [formAberto, setFormAberto] = useState(chamados.length === 0);
  const [categoria, setCategoria] = useState<CategoriaChamado | "">(contaRestrita ? "conta" : "");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleAbrir(e: FormEvent) {
    e.preventDefault();
    const problema = problemaNovoChamado(categoria, assunto, descricao);
    if (problema) {
      setErro(problema);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      // Mesmo clienteId em nova tentativa: o banco devolve o chamado já aberto em vez de duplicar
      const id = clienteId || crypto.randomUUID();
      setClienteId(id);
      const chamado = await abrirChamado({ categoria: categoria as CategoriaChamado, assunto, descricao, clienteId: id });
      router.push(caminhoChamado(chamado.id));
    } catch (err) {
      setErro(
        err instanceof TypeError
          ? "Não foi possível enviar. Confira a conexão e tente de novo."
          : (err as { message?: string })?.message || "Não foi possível abrir o chamado."
      );
      setEnviando(false);
    }
  }

  if (chamadoAberto) {
    return (
      <div className="space-y-3">
        <Link href="/painel/suporte" className={`inline-flex items-center gap-1 min-h-[44px] text-sm font-semibold text-petroleo hover:underline rounded-controle ${FOCO}`}>
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          Meus chamados
        </Link>
        <div className="bg-superficie border border-borda rounded-card overflow-hidden h-[70vh] min-h-[420px]">
          <ConversaSuporte key={chamadoAberto.id} chamado={chamadoAberto} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-petroleo flex items-center gap-2">
            <LifeBuoy size={20} strokeWidth={1.75} aria-hidden="true" />
            Fale com a equipe
          </h2>
          <p className="text-sm text-tinta-suave mt-1 max-w-xl">
            Abra um chamado e converse com a equipe do Circular por aqui. Você recebe o protocolo e os avisos de resposta
            no e-mail da faculdade.
          </p>
        </div>
        {!formAberto && emAndamento < LIMITES_CHAMADO.emAndamento && (
          <button
            type="button"
            onClick={() => setFormAberto(true)}
            className={`bg-acao hover:bg-acao-hover text-white font-semibold text-sm px-4 py-2.5 min-h-[44px] rounded-controle transition inline-flex items-center gap-2 ${FOCO}`}
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            Abrir chamado
          </button>
        )}
      </div>

      {formAberto && (
        <form onSubmit={handleAbrir} className="bg-superficie border border-borda rounded-card p-5 space-y-4" noValidate>
          {emAndamento >= LIMITES_CHAMADO.emAndamento && (
            <p className="text-sm text-tinta-suave">
              Você já tem {LIMITES_CHAMADO.emAndamento} chamados em andamento. Continue a conversa em um deles.
            </p>
          )}
          <div>
            <label htmlFor="chamado-categoria" className="block text-sm font-semibold text-tinta mb-1">
              Sobre o que é?
            </label>
            <select
              id="chamado-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaChamado)}
              className={CAMPO}
            >
              <option value="">Escolha uma opção</option>
              {CATEGORIAS_CHAMADO.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="chamado-assunto" className="block text-sm font-semibold text-tinta mb-1">
              Título
            </label>
            <input
              id="chamado-assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              maxLength={LIMITES_CHAMADO.assuntoMax}
              placeholder="Ex.: Minha conta foi suspensa"
              className={CAMPO}
            />
          </div>
          <div>
            <label htmlFor="chamado-descricao" className="block text-sm font-semibold text-tinta mb-1">
              Conte o que aconteceu
            </label>
            <textarea
              id="chamado-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={LIMITES_CHAMADO.mensagemMax}
              rows={5}
              placeholder="Explique com detalhes. Não envie senhas nem dados bancários."
              className={`${CAMPO} resize-y`}
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm text-perigo">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={enviando || emAndamento >= LIMITES_CHAMADO.emAndamento}
              className={`bg-acao hover:bg-acao-hover text-white font-semibold text-sm px-4 py-2.5 min-h-[44px] rounded-controle transition disabled:opacity-50 ${FOCO}`}
            >
              {enviando ? "Enviando..." : "Enviar chamado"}
            </button>
            {chamados.length > 0 && (
              <button
                type="button"
                onClick={() => setFormAberto(false)}
                className={`bg-superficie text-petroleo border border-borda-controle hover:border-petroleo rounded-controle text-sm font-semibold px-4 min-h-[44px] ${FOCO}`}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {chamados.length > 0 && (
        <section aria-labelledby="meus-chamados-titulo">
          <h3 id="meus-chamados-titulo" className="text-sm font-bold text-tinta mb-3">
            Meus chamados
          </h3>
          <ul className="bg-superficie border border-borda rounded-card divide-y divide-borda">
            {chamados.map((c) => (
              <li key={c.id}>
                <Link href={caminhoChamado(c.id)} className={`flex items-start justify-between gap-3 px-5 py-4 hover:bg-pagina rounded-card ${FOCO}`}>
                  <div className="min-w-0">
                    <p className="text-xs text-tinta-suave">{c.protocolo}</p>
                    <p className="font-semibold text-tinta truncate">{c.assunto}</p>
                    {c.ultima && (
                      <p className="text-sm text-tinta-suave truncate">
                        {c.ultima.de_equipe ? "Equipe: " : "Você: "}
                        {c.ultima.texto}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-xs text-tinta-sutil">{horarioMensagem(c.atualizado_em)}</span>
                    <span className="text-xs font-semibold text-tinta-suave">{STATUS_CHAMADO[c.status]}</span>
                    {c.nao_lidas > 0 && (
                      <span className="rounded-pill bg-acao text-white text-xs font-semibold px-2 py-0.5">
                        {c.nao_lidas === 1 ? "1 resposta nova" : `${c.nao_lidas} respostas novas`}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-tinta-suave flex items-center gap-2">
        <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
        Prefere e-mail? Escreva para{" "}
        <a href={linkMailtoSuporte()} className="text-petroleo font-semibold hover:underline">
          {EMAIL_SUPORTE}
        </a>
      </p>
    </div>
  );
}
