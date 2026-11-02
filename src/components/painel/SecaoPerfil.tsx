import EditorHorarios from "@/components/EditorHorarios";
import { lerHorarios, problemaHorarios } from "@/lib/horarios";
import { useState, useMemo } from "react";
import {
  atualizarMeuNome,
  excluirMinhaConta,
  solicitarTrocaEmail,
  solicitarVerificacaoMatricula,
  updateLoja,
  verificarMatriculaInstantanea,
} from "@/lib/queries";
import { normalizarTelefone } from "@/lib/contato";
import { removerImagensDaConta, uploadImagemLoja } from "@/lib/storage";
import { useConfirmacao } from "@/components/ModalConfirmacao";
import { supabase } from "@/lib/supabase";
import SeloVerificado from "@/components/SeloVerificado";
import { instituicaoDoEmail, LIMITES_TEXTO, problemaNomeExibicao, validarEmail } from "@/lib/validacoes";
import type { HorarioDisponivel, Instituicao, Loja, Usuario } from "@/types";
import {
  Check,
  CircleCheck,
  Clock,
  GraduationCap,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";

type MatriculaStatus = Usuario["matricula_status"];

interface Props {
  loja: Loja;
  usuario: Usuario | null;
  userEmail: string;
  instituicoes: Instituicao[];
  matriculaStatus: MatriculaStatus;
  produtoIds: number[];
  onLojaAtualizada: (alteracoes: Partial<Loja>) => void;
  onNomeAtualizado: (nome: string, sobrenome: string) => void;
  onMatriculaStatus: (status: MatriculaStatus) => void;
}

const LOCAIS_SUGERIDOS = [
  "RU Central",
  "Biblioteca Universitária",
  "Centro de Vivência",
  "Centro Acadêmico (CA)",
  "Entrada Principal do Campus",
  "Bloco de Aulas",
];

export default function SecaoPerfil({
  loja,
  usuario,
  userEmail,
  instituicoes,
  matriculaStatus,
  produtoIds,
  onLojaAtualizada,
  onNomeAtualizado,
  onMatriculaStatus,
}: Props) {
  const [excluindoConta, setExcluindoConta] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const { confirmar, modalConfirmacao } = useConfirmacao();
  const [matriculaInput, setMatriculaInput] = useState(usuario?.matricula || "");
  const [verificandoInstantaneo, setVerificandoInstantaneo] = useState(false);
  const [enviandoMatricula, setEnviandoMatricula] = useState(false);
  const [mensagemVerificacao, setMensagemVerificacao] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const emailAtual = userEmail || usuario?.email || "";
  const emailEhUniversitario = useMemo(
    () => instituicaoDoEmail(emailAtual, instituicoes) !== null,
    [emailAtual, instituicoes]
  );
  const campusAtual = instituicoes.find((i) => i.id === usuario?.instituicoes_id) ?? null;

  // Troca de e-mail = troca de campus (o banco recalcula na confirmação e pausa os anúncios)
  const [novoEmail, setNovoEmail] = useState("");
  const [trocandoEmail, setTrocandoEmail] = useState(false);
  const [mensagemEmail, setMensagemEmail] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const campusNovoEmail = instituicaoDoEmail(novoEmail, instituicoes);

  async function handleTrocarEmail(e: React.FormEvent) {
    e.preventDefault();
    setMensagemEmail(null);
    const email = novoEmail.trim().toLowerCase();
    if (!validarEmail(email)) {
      setMensagemEmail({ tipo: "erro", texto: "Informe um e-mail válido." });
      return;
    }
    if (email === emailAtual.toLowerCase()) {
      setMensagemEmail({ tipo: "erro", texto: "Esse já é o seu e-mail." });
      return;
    }
    if (!campusNovoEmail) {
      setMensagemEmail({ tipo: "erro", texto: "Esse e-mail não é de uma faculdade participante do Circular." });
      return;
    }
    const mudaCampus = campusNovoEmail.id !== usuario?.instituicoes_id;
    if (
      mudaCampus &&
      !(await confirmar({
        titulo: "Mudar de campus?",
        mensagem:
          `Seu campus vai mudar para ${campusNovoEmail.nome} depois que você confirmar o novo e-mail. ` +
          "Seus anúncios ativos serão pausados para você revisar.",
        rotuloConfirmar: "Trocar e-mail",
      }))
    ) {
      return;
    }

    setTrocandoEmail(true);
    try {
      await solicitarTrocaEmail(email);
      setNovoEmail("");
      setMensagemEmail({
        tipo: "sucesso",
        texto: `Enviamos um link de confirmação para ${email}. A troca só vale depois que você clicar nele.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      setMensagemEmail({
        tipo: "erro",
        texto: msg.includes("already")
          ? "Esse e-mail já está em uso por outra conta."
          : msg.includes("database error")
            ? "Esse e-mail não é de uma faculdade participante do Circular."
            : "Não foi possível pedir a troca agora. Tente de novo em alguns minutos.",
      });
    } finally {
      setTrocandoEmail(false);
    }
  }

  // Estados de edição de perfil
  // Nome pessoal (cadastro) e nome de exibição opcional; o nome público é um ou outro
  const [nomePessoal, setNomePessoal] = useState(usuario?.nome || "");
  const [sobrenome, setSobrenome] = useState(usuario?.sobrenome || "");
  const [nomeExibicao, setNomeExibicao] = useState(loja.nome_exibicao || "");
  const nomePublico = nomeExibicao.trim() || `${nomePessoal.trim()} ${sobrenome.trim()}`.trim() || loja.nome;
  const [descricao, setDescricao] = useState(loja.descricao || "");
  const [whatsapp, setWhatsapp] = useState(loja.whatsapp || loja.contato || "");
  const [locais, setLocais] = useState<string[]>(loja.locais_entrega || []);
  const [horarios, setHorarios] = useState<HorarioDisponivel[]>(lerHorarios(loja.horarios));
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [capaUploading, setCapaUploading] = useState(false);
  const [mensagemPerfil, setMensagemPerfil] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Handlers de Verificação Acadêmica
  async function handleValidacaoInstantanea() {
    if (!usuario) return;
    setVerificandoInstantaneo(true);
    setMensagemVerificacao(null);
    try {
      const res = await verificarMatriculaInstantanea(matriculaInput);
      if (res.success) {
        onMatriculaStatus("verificado");
        setMensagemVerificacao({ tipo: "sucesso", texto: res.message });
      } else {
        setMensagemVerificacao({ tipo: "erro", texto: res.message });
      }
    } catch (err) {
      setMensagemVerificacao({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Erro ao validar matrícula.",
      });
    } finally {
      setVerificandoInstantaneo(false);
    }
  }

  async function handleSubmeterMatricula(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    if (!matriculaInput.trim()) {
      setMensagemVerificacao({ tipo: "erro", texto: "Informe o número da matrícula." });
      return;
    }
    setEnviandoMatricula(true);
    setMensagemVerificacao(null);
    try {
      await solicitarVerificacaoMatricula(usuario.id, matriculaInput);
      onMatriculaStatus("pendente");
      setMensagemVerificacao({
        tipo: "sucesso",
        texto: "Matrícula enviada para análise da moderação! Em breve seu selo Aluno Verificado será ativado.",
      });
    } catch (err) {
      setMensagemVerificacao({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Erro ao enviar matrícula.",
      });
    } finally {
      setEnviandoMatricula(false);
    }
  }

  // Upload de avatar
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setAvatarUploading(true);

    try {
      const url = await uploadImagemLoja(loja.id, "avatar", file);
      onLojaAtualizada({ avatar_url: url });
      setMensagemPerfil({ tipo: "sucesso", texto: "Foto de perfil atualizada com sucesso!" });
    } catch (err) {
      setMensagemPerfil({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Erro ao enviar imagem.",
      });
    } finally {
      setAvatarUploading(false);
    }
  }

  // Upload da capa do perfil público
  async function handleCapaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setCapaUploading(true);
    try {
      const url = await uploadImagemLoja(loja.id, "capa", file);
      onLojaAtualizada({ capa_url: url });
      setMensagemPerfil({ tipo: "sucesso", texto: "Foto de capa atualizada." });
    } catch (err) {
      setMensagemPerfil({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Erro ao enviar imagem.",
      });
    } finally {
      setCapaUploading(false);
    }
  }

  // Toggle local de entrega no campus
  function toggleLocal(local: string) {
    if (locais.includes(local)) {
      setLocais(locais.filter((l) => l !== local));
    } else {
      setLocais([...locais, local]);
    }
  }

  async function handleExcluirConta() {
    const ok = await confirmar({
      titulo: "Excluir sua conta?",
      mensagem: "Isso apaga seu perfil, seus anúncios e seus favoritos. Não dá para desfazer.",
      rotuloConfirmar: "Excluir conta",
      perigo: true,
    });
    if (!ok) return;
    setExcluindoConta(true);
    setErroExclusao(null);
    try {
      // Imagens primeiro: a política do Storage exige que loja e produtos ainda existam
      await removerImagensDaConta(loja.id, produtoIds);
      await excluirMinhaConta();
      await supabase.auth.signOut().catch(() => undefined);
      window.location.href = "/";
    } catch (err) {
      setErroExclusao((err as { message?: string })?.message || "Não foi possível excluir a conta. Tente de novo.");
      setExcluindoConta(false);
    }
  }

  // Salvar alterações no perfil
  async function handleSalvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setMensagemPerfil(null);
    if (usuario && !nomePessoal.trim()) {
      setMensagemPerfil({ tipo: "erro", texto: "Informe seu nome." });
      return;
    }
    const problemaExibicao = problemaNomeExibicao(nomeExibicao);
    if (problemaExibicao) {
      setMensagemPerfil({ tipo: "erro", texto: problemaExibicao });
      return;
    }
    const problemaHorario = problemaHorarios(horarios);
    if (problemaHorario) {
      setMensagemPerfil({ tipo: "erro", texto: problemaHorario });
      return;
    }
    setSalvandoPerfil(true);

    // lojas.contato guarda só dígitos (DDI + DDD + número). Em branco = sem WhatsApp (contato só pelo chat)
    const contato = whatsapp.trim() ? normalizarTelefone(whatsapp) : "";
    if (contato && contato.length < 12) {
      setMensagemPerfil({ tipo: "erro", texto: "Confira o WhatsApp: informe DDD e número, ou deixe em branco." });
      setSalvandoPerfil(false);
      return;
    }

    try {
      const nomeMudou =
        usuario && (nomePessoal.trim() !== usuario.nome || sobrenome.trim() !== (usuario.sobrenome || ""));
      if (usuario && nomeMudou) {
        await atualizarMeuNome(usuario.id, nomePessoal, sobrenome);
        onNomeAtualizado(nomePessoal.trim(), sobrenome.trim());
      }

      await updateLoja(loja.id, {
        nome_exibicao: nomeExibicao.trim() || null,
        descricao: descricao.trim(),
        whatsapp: whatsapp.trim(),
        contato,
        locais_entrega: locais,
        horarios,
      });

      onLojaAtualizada({
        nome: nomePublico,
        nome_exibicao: nomeExibicao.trim() || null,
        descricao: descricao.trim(),
        whatsapp: whatsapp.trim(),
        contato,
        locais_entrega: locais,
        horarios,
      });

      setMensagemPerfil({ tipo: "sucesso", texto: "Perfil atualizado." });
    } catch (err) {
      setMensagemPerfil({
        tipo: "erro",
        texto: err instanceof Error ? err.message : "Erro ao salvar alterações.",
      });
    } finally {
      setSalvandoPerfil(false);
    }
  }

  return (
    <div className="w-full bg-superficie border border-borda rounded-card p-6 sm:p-8">
      <h2 className="text-lg sm:text-xl font-bold text-petroleo mb-1">
        Editar perfil
      </h2>
      <p className="text-sm text-tinta-suave mb-6">
        Essas informações aparecem no seu perfil público para os outros alunos do campus.
      </p>

      {mensagemPerfil && (
        <div
          className={`mb-6 p-4 rounded-card text-xs font-semibold flex items-center gap-2 ${
            mensagemPerfil.tipo === "sucesso"
              ? "bg-troca-50 text-troca-texto"
              : "bg-perigo-50 text-perigo"
          }`}
        >
          <span aria-hidden="true">{mensagemPerfil.tipo === "sucesso" ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />}</span>
          <span>{mensagemPerfil.texto}</span>
        </div>
      )}

      <form onSubmit={handleSalvarPerfil} className="space-y-5">
        {/* Upload Foto de Perfil */}
        <div>
          <label className="block text-sm font-semibold text-tinta mb-2">
            Foto de Perfil
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-card bg-pagina border border-borda overflow-hidden shrink-0 flex items-center justify-center">
              {loja.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={loja.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-tinta-sutil">
                  {nomePublico.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-controle border border-borda-controle hover:border-borda-controle bg-superficie font-semibold text-xs text-tinta cursor-pointer transition">
                <span>{avatarUploading ? "Enviando..." : "Alterar foto"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={avatarUploading}
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-tinta-sutil mt-1">
                Formatos JPG, PNG ou WebP até 3 MB.
              </p>
            </div>
          </div>
        </div>

        {/* Foto de capa: faixa no topo do perfil público (mesma proporção da prévia) */}
        <div>
          <p className="block text-sm font-semibold text-tinta mb-2">Foto de capa</p>
          <div className="h-28 sm:h-36 w-full rounded-card bg-petroleo-50 border border-borda overflow-hidden">
            {loja.capa_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loja.capa_url} alt="Foto de capa atual" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-controle border border-borda-controle bg-superficie font-semibold text-xs text-tinta cursor-pointer transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-petroleo has-[:focus-visible]:outline-offset-2">
              <span>{capaUploading ? "Enviando..." : loja.capa_url ? "Alterar capa" : "Adicionar capa"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={capaUploading}
                onChange={handleCapaChange}
                className="sr-only"
              />
            </label>
            <p className="text-xs text-tinta-sutil">
              Imagem larga (ex.: 1600 × 500), JPG, PNG ou WebP até 3 MB. Aparece no topo do seu perfil público.
            </p>
          </div>
        </div>

        {/* Nome pessoal: identidade da conta (a equipe do Circular sempre vê) */}
        {usuario && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="perfil-nome" className="block text-sm font-semibold text-tinta mb-1">
                Nome *
              </label>
              <input
                id="perfil-nome"
                type="text"
                required
                value={nomePessoal}
                maxLength={LIMITES_TEXTO.usuarioNome}
                onChange={(e) => setNomePessoal(e.target.value)}
                autoComplete="given-name"
                className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie"
              />
            </div>
            <div>
              <label htmlFor="perfil-sobrenome" className="block text-sm font-semibold text-tinta mb-1">
                Sobrenome
              </label>
              <input
                id="perfil-sobrenome"
                type="text"
                value={sobrenome}
                maxLength={LIMITES_TEXTO.usuarioSobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                autoComplete="family-name"
                className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie"
              />
            </div>
          </div>
        )}

        {/* Nome de exibição: marca opcional; se preenchido, substitui o nome pessoal no site */}
        <div>
          <label htmlFor="perfil-nome-exibicao" className="block text-sm font-semibold text-tinta mb-1">
            Nome de exibição <span className="font-normal text-tinta-suave">(opcional)</span>
          </label>
          <input
            id="perfil-nome-exibicao"
            type="text"
            value={nomeExibicao}
            maxLength={LIMITES_TEXTO.nomeExibicao}
            onChange={(e) => setNomeExibicao(e.target.value)}
            placeholder="Ex.: Bia Doces, Monitoria de Cálculo"
            aria-describedby="perfil-nome-exibicao-ajuda"
            className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie"
          />
          <p id="perfil-nome-exibicao-ajuda" className="text-xs text-tinta-suave mt-1.5">
            Para quem vende com uma marca. Se preenchido, aparece no lugar do seu nome nos anúncios e no perfil;
            seu nome continua visível só para a equipe do Circular. Quem falar com você pelo WhatsApp vê o seu
            perfil de lá; pelo chat, só o nome público. Os outros alunos vão ver: <strong className="text-tinta">{nomePublico}</strong>
          </p>
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-sm font-semibold text-tinta mb-1">
            WhatsApp para negociação (opcional)
          </label>
          <input
            type="tel"
            value={whatsapp}
            maxLength={LIMITES_TEXTO.whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(31) 99999-9999"
            className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie"
          />
          <p className="text-xs text-tinta-sutil mt-1">
            Com o número, os colegas podem chamar você no WhatsApp. Em branco, ele não aparece para ninguém e
            o contato fica só pelo chat do Circular, sem expor seu telefone.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-semibold text-tinta mb-1">
            Bio / Apresentação
          </label>
          <textarea
            rows={3}
            value={descricao}
            maxLength={LIMITES_TEXTO.lojaDescricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Aluno do 4º semestre de Engenharia desapegando de livros do ciclo básico..."
            className="w-full px-4 py-2.5 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 text-sm bg-superficie resize-y"
          />
        </div>

        {/* Locais de Encontro */}
        <div>
          <label className="block text-sm font-semibold text-tinta mb-1">
            Locais que você costuma entregar no campus
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {LOCAIS_SUGERIDOS.map((local) => {
              const ativo = locais.includes(local);
              return (
                <button
                  key={local}
                  type="button"
                  onClick={() => toggleLocal(local)}
                  aria-pressed={ativo}
                  className={`text-sm px-4 min-h-[44px] rounded-pill border transition flex items-center gap-1.5 ${
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

        {/* Dias e horários no campus (migração 28) */}
        <fieldset>
          <legend className="block text-sm font-semibold text-tinta">Quando você está no campus</legend>
          <p className="text-xs text-tinta-suave mt-1 mb-2">
            Aparece no seu perfil e nos seus anúncios, para combinar a entrega. Deixe tudo desmarcado se preferir não mostrar.
          </p>
          <EditorHorarios valor={horarios} onChange={setHorarios} />
        </fieldset>

        {/* Botão Salvar */}
        <div className="pt-4 border-t border-borda flex items-center justify-end">

          <button
            type="submit"
            disabled={salvandoPerfil}
            className="bg-acao hover:bg-acao-hover text-white text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
          >
            {salvandoPerfil ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>

      {/* Seção de Verificação Acadêmica */}
      <div className="mt-8 pt-8 border-t border-borda">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
            <h3 className="text-base font-bold text-petroleo">Verificação de matrícula</h3>
          </div>

          {matriculaStatus === "verificado" ? (
            <SeloVerificado tamanho="md" />
          ) : matriculaStatus === "pendente" ? (
            <span className="inline-flex items-center gap-1.5 bg-doacao-50 text-doacao text-xs font-bold px-3 py-1 rounded-pill">
              <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>Em análise</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-pagina text-tinta border border-borda-controle text-xs font-bold px-3 py-1 rounded-pill">
              <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Não verificado</span>
            </span>
          )}
        </div>

        <p className="text-sm text-tinta-suave mb-5 leading-relaxed">
          O selo <strong>Verificado</strong> mostra que você tem vínculo ativo com a universidade. Só alunos verificados podem anunciar.
        </p>

        {mensagemVerificacao && (
          <div
            className={`mb-5 p-4 rounded-card text-xs font-semibold flex items-center gap-2 ${
              mensagemVerificacao.tipo === "sucesso"
                ? "bg-troca-50 text-troca-texto"
                : "bg-perigo-50 text-perigo"
            }`}
          >
            <span aria-hidden="true">{mensagemVerificacao.tipo === "sucesso" ? <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" /> : <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />}</span>
            <span>{mensagemVerificacao.texto}</span>
          </div>
        )}

        {matriculaStatus === "verificado" ? (
          <div className="bg-petroleo-50 rounded-card p-5 text-petroleo">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-pill bg-superficie flex items-center justify-center shrink-0">
                <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Sua matrícula está verificada</h4>
                <p className="text-sm mt-1 leading-relaxed">Seus anúncios e seu perfil mostram o selo Verificado.</p>
                {usuario?.matricula && (
                  <p className="text-xs font-semibold mt-2">
                    Matrícula registrada: {usuario.matricula}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Opção 1: Validação Instantânea por E-mail Institucional */}
            {emailEhUniversitario && (
              <div className="bg-troca-50 rounded-card p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-troca-texto bg-superficie px-2.5 py-1 rounded-pill">
                      Recomendado
                    </span>
                    <h4 className="text-sm font-bold text-tinta mt-1">
                      Validar com seu e-mail institucional
                    </h4>
                    <p className="text-xs text-tinta-suave mt-0.5">
                      Detectamos que seu e-mail <strong>{userEmail}</strong> pertence a um domínio acadêmico reconhecido.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={verificandoInstantaneo}
                    onClick={handleValidacaoInstantanea}
                    className="bg-acao hover:bg-acao-hover text-white text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                  >
                    {verificandoInstantaneo ? "Validando..." : "Validar agora"}
                  </button>
                </div>
              </div>
            )}

            {/* Opção 2: Validação por Matrícula e Faculdade */}
            <div className="bg-pagina border border-borda rounded-card p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-tinta mb-1">
                {emailEhUniversitario ? "Ou informe sua matrícula para o registro:" : "Informe seus dados acadêmicos para validação:"}
              </h4>
              <p className="text-sm text-tinta-suave mb-4">
                A moderação confere sua matrícula e libera o selo.
              </p>

              <form onSubmit={handleSubmeterMatricula} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-tinta mb-1">
                      Número da matrícula *
                    </label>
                    <input
                      type="text"
                      required
                      value={matriculaInput}
                      maxLength={LIMITES_TEXTO.matricula}
                      onChange={(e) => setMatriculaInput(e.target.value)}
                      placeholder="Ex: 2024019283"
                      className="w-full text-sm px-3 py-2 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 bg-superficie"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={enviandoMatricula || !matriculaInput.trim()}
                    className="bg-superficie text-petroleo border border-borda-controle hover:border-petroleo text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                  >
                    {enviandoMatricula ? "Enviando..." : matriculaStatus === "pendente" ? "Atualizar dados enviados" : "Enviar matrícula"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div id="trocar-email" className="mt-8 pt-6 border-t border-borda scroll-mt-32">
        <div className="flex items-center gap-2">
          <Mail size={20} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
          <h3 className="text-base font-bold text-petroleo">E-mail e campus</h3>
        </div>
        <p className="text-sm text-tinta-suave mt-1">
          {campusAtual ? (
            <>
              Seu campus é <strong className="text-tinta">{campusAtual.nome}</strong>, definido pelo e-mail {emailAtual}.
            </>
          ) : (
            <>Seu e-mail atual ({emailAtual}) não é de uma faculdade participante.</>
          )}{" "}
          Mudou de faculdade? Troque o e-mail e você passa a ver os anúncios do novo campus.
        </p>

        {mensagemEmail && (
          <p
            role={mensagemEmail.tipo === "erro" ? "alert" : "status"}
            className={`mt-3 p-3 rounded-card text-sm ${
              mensagemEmail.tipo === "sucesso" ? "bg-troca-50 text-troca-texto" : "bg-perigo-50 text-perigo"
            }`}
          >
            {mensagemEmail.texto}
          </p>
        )}

        <form onSubmit={handleTrocarEmail} className="mt-3 flex flex-col sm:flex-row gap-3 sm:items-start">
          <div className="flex-1">
            <label htmlFor="novo-email" className="sr-only">
              Novo e-mail da faculdade
            </label>
            <input
              id="novo-email"
              type="email"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="novo@aluno.suafaculdade.br"
              aria-describedby="campus-novo-email"
              className="w-full text-sm px-3 py-2 min-h-[44px] rounded-controle border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 bg-superficie"
            />
            {novoEmail.includes("@") && (
              <p id="campus-novo-email" aria-live="polite" className="text-xs text-tinta-suave mt-1 flex items-center gap-1">
                <GraduationCap size={14} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                {campusNovoEmail ? (
                  <>
                    Novo campus: <strong className="text-petroleo">{campusNovoEmail.nome}</strong>
                  </>
                ) : (
                  "Domínio fora das faculdades participantes"
                )}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={trocandoEmail || !novoEmail.trim()}
            className="bg-superficie text-petroleo border border-borda-controle hover:border-petroleo text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition disabled:opacity-50 shrink-0 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
          >
            {trocandoEmail ? "Enviando…" : "Trocar e-mail"}
          </button>
        </form>
      </div>

      <div className="mt-8 pt-6 border-t border-borda">
        <h3 className="text-base font-bold text-perigo">Excluir conta</h3>
        <p className="text-sm text-tinta-suave mt-1">
          Apaga seu perfil, seus anúncios, fotos e favoritos. Não dá para desfazer.
        </p>
        {erroExclusao && (
          <p role="alert" className="mt-3 p-3 rounded-card bg-perigo-50 text-perigo text-sm">{erroExclusao}</p>
        )}
        <button
          type="button"
          onClick={handleExcluirConta}
          disabled={excluindoConta}
          className="mt-3 inline-flex items-center gap-1.5 bg-superficie text-perigo border border-borda-controle hover:border-perigo text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
        >
          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          {excluindoConta ? "Excluindo…" : "Excluir minha conta"}
        </button>
      </div>
      {modalConfirmacao}
    </div>
  );
}
