export interface Instituicao {
  id: number;
  nome: string;
  cnpj: string | null;
  dominios: string[] | null; // domínios de e-mail que definem o campus do aluno
}

export type UsuarioStatus = "ativo" | "bloqueado";

export interface Usuario {
  id: number;
  nome: string;
  sobrenome: string;
  email: string;
  password: string;
  telefone: string;
  cpf: string;
  matricula: string;
  matricula_validada: boolean;
  matricula_status: "pendente" | "verificado" | "rejeitado";
  instituicoes_id: number;
  status: UsuarioStatus;
  is_admin: boolean;
}

export interface Favorito {
  id: string;
  usuario_id: number;
  produto_id: number;
  criado_em: string;
}

export type LojaStatus = "pendente" | "ativo" | "pausado" | "reprovado";

export interface Loja {
  id: number;
  usuario_id: number;
  nome: string; // nome público: calculado pelo banco (nome_exibicao ou nome + sobrenome); não gravar
  nome_exibicao: string | null; // marca opcional do aluno (migração 23)
  descricao: string;
  contato: string;
  status: LojaStatus;
  criado_em: string;
  avatar_url: string | null;
  capa_url: string | null;
  slug: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  whatsapp: string | null;
  locais_entrega: string[];
  horarios: HorarioDisponivel[]; // dias e horários no campus (migração 28)
}

// Loja como aparece para outros alunos: o telefone só sai pela RPC contato_vendedor
export type LojaPublica = Omit<Loja, "contato" | "whatsapp">;

export type ProdutoStatus = "ativo" | "pausado" | "vendido";

export interface Produto {
  id: number;
  loja_id: number;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string | null;
  status: ProdutoStatus;
  criado_em: string;
  categoria_id: number;
  destaque: boolean;
  aceita_troca: boolean;
  renovado_em: string;
  vendido_em: string | null;
}

export interface Categoria {
  id: number;
  nome: string;
  parent_id?: number | null;
  icone?: string;
}

export interface CategoriaComFilhos extends Categoria {
  filhos: Categoria[];
}

export interface ProdutoListagem {
  id: number;
  loja_id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  categoria_id: number;
  categoria_nome: string;
  loja_nome: string;
  loja_descricao: string | null;
  loja_avatar_url: string | null;
  destaque: boolean;
  aceita_troca: boolean;
  loja_verificada?: boolean;
}

export interface UsuarioModeracao {
  id: number;
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  matricula: string;
  matricula_status: "pendente" | "verificado" | "rejeitado";
  matricula_validada: boolean;
  instituicoes_id: number | null;
  instituicao_nome?: string;
  loja_id?: number;
  status: UsuarioStatus;
  is_admin: boolean;
  criado_em: string | null;
  bloqueado_ate: string | null; // com status 'bloqueado': suspensão até esta data; sem data, bloqueio sem prazo
  moderacao_motivo: string | null;
  anuncios_ativos: number;
  denuncias_abertas: number;
}

// Faixa de horário em que o aluno está no campus (lojas.horarios; dia 0 = domingo … 6 = sábado)
export interface HorarioDisponivel {
  dia: number;
  inicio: string; // "HH:MM"
  fim: string;
}

export type AcaoModeracaoConta = "suspender" | "bloquear" | "reativar";

// Histórico de /admin/contas (admin_historico_conta)
export interface EventoModeracaoConta {
  id: number;
  acao: AcaoModeracaoConta | "fim_suspensao";
  motivo: string | null;
  ate: string | null;
  criado_em: string;
  admin_nome: string | null; // null = automático (fim da suspensão)
}

// Aviso do painel do próprio aluno (minha_situacao_conta)
export interface SituacaoConta {
  status: UsuarioStatus;
  bloqueado_ate: string | null;
  moderacao_motivo: string | null;
}

export interface LojaModeracao {
  id: number;
  nome: string;
  slug: string | null;
  status: LojaStatus;
  criado_em: string;
  avatar_url: string | null;
  usuario_id: number;
  dono_nome: string;
  dono_email: string;
  matricula_validada: boolean;
  total_produtos: number;
  produtos_ativos: number;
  produtos_vendidos: number;
  total_interesses: number;
}

export type MotivoDenuncia = "proibido" | "golpe" | "ofensivo" | "falso" | "outro";
export type DenunciaStatus = "aberta" | "resolvida" | "descartada";

// Tipo do que foi denunciado (migrações 25 e 26): anúncio e perfil, um comentário ou uma mensagem do chat
export type AlvoDenuncia = "anuncio" | "perfil" | "pergunta" | "resposta" | "avaliacao" | "mensagem";

export interface DenunciaModeracao {
  id: number;
  motivo: MotivoDenuncia;
  detalhes: string | null;
  status: DenunciaStatus;
  criado_em: string;
  alvo_descricao: string;
  loja_id: number | null;
  produto_id: number | null;
  denunciante_nome: string | null;
  denunciante_email: string | null;
  alvo_tipo: AlvoDenuncia;
  pergunta_id: number | null;
  avaliacao_id: number | null;
  conteudo: string | null; // cópia do comentário denunciado (fica mesmo se o autor apagar)
  link: string | null;
  comentario_no_ar: boolean | null; // null para anúncio/perfil/mensagem
  mensagem_id: number | null;
  tem_conversa: boolean; // a cópia da conversa denunciada ainda existe (some 30 dias depois de resolvida)
}

export interface ProdutoModeracao {
  id: number;
  nome: string;
  preco: number;
  imagem_url: string | null;
  status: ProdutoStatus;
  destaque: boolean;
  loja_id: number;
  loja_nome: string;
}

export interface GrupoCategoria {
  categoria: Categoria;
  produtos: ProdutoListagem[];
}

export type OrdenacaoProdutos = "recentes" | "preco_asc" | "preco_desc";

export interface PerfilPublico extends LojaPublica {
  usuario_criado_em?: string;
  matricula_status?: "pendente" | "verificado" | "rejeitado";
  instituicao_nome?: string;
}

// Perfil aberto pela RPC perfil_leitura: de outro campus (mesmoCampus = false) é só leitura
export interface PerfilLeitura {
  perfil: PerfilPublico;
  produtos: ProdutoListagem[];
  mesmoCampus: boolean;
  ehDono: boolean;
  temWhatsapp: boolean; // sem número cadastrado, o botão do WhatsApp não aparece (só o chat)
  // Vai no link do QR code da loja (src/lib/compartilhar.ts); qualquer aluno logado pode compartilhar
  codigoCompartilhamento: string | null;
}

// Nome da loja e da faculdade mostrados no login para quem chegou pelo QR code
export interface ResumoLojaCompartilhada {
  loja_nome: string;
  instituicao_nome: string | null;
}

// Página do anúncio (RPC anuncio_leitura, migração 22)
export interface AnuncioDetalhe {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  categoria_id: number;
  categoria_nome: string | null;
  aceita_troca: boolean;
  destaque: boolean;
  status: ProdutoStatus;
  criado_em: string;
  renovado_em: string;
}

export interface LojaDoAnuncio {
  id: number;
  slug: string | null;
  nome: string;
  descricao: string | null;
  avatar_url: string | null;
  locais_entrega: string[];
  horarios: HorarioDisponivel[]; // dias e horários no campus (migração 28)
  verificada: boolean;
  instituicao_nome: string | null;
}

// "ok": página completa (de outro campus, só leitura; o dono vê o próprio anúncio em qualquer estado).
// "indisponivel": vendido, pausado ou vencido, visto por quem não é dono.
export type AnuncioLeitura =
  | {
      estado: "ok";
      disponivel: boolean;
      ehDono: boolean;
      mesmoCampus: boolean;
      temWhatsapp: boolean;
      codigoCompartilhamento: string | null;
      favoritado: boolean;
      anuncio: AnuncioDetalhe;
      loja: LojaDoAnuncio;
      outros: ProdutoListagem[];
    }
  | { estado: "indisponivel"; nome: string; loja: { slug: string | null; nome: string } | null };

// Prévia de anúncio para o login e o WhatsApp (link compartilhado com código)
export interface ResumoAnuncioCompartilhado {
  anuncio_nome: string;
  preco: number;
  aceita_troca: boolean;
  imagem_url: string | null;
  loja_nome: string;
  instituicao_nome: string | null;
}

// Perguntas nos anúncios e avaliação do vendedor (migração 24; moderação pela Vettly)
export type StatusModeracao = "pendente" | "aprovado" | "recusado";

export interface PerguntaAnuncio {
  id: number;
  texto: string;
  autor_nome: string | null;
  criado_em: string;
  minha: boolean; // o aluno logado fez a pergunta (vê o status dela)
  status: StatusModeracao;
  resposta: string | null; // aprovada, ou a do próprio dono em qualquer status
  resposta_status: StatusModeracao | null;
  respondida_em: string | null;
}

export interface AvaliacaoVendedor {
  id: number;
  nota: number;
  comentario: string | null;
  autor_nome: string | null;
  criado_em: string;
}

export interface ResumoAvaliacoes {
  media: number | null;
  total: number;
  pode_avaliar: boolean; // já falou com o vendedor pelo Circular (chat ou WhatsApp) e não é o dono
  minha: { id: number; nota: number; comentario: string | null; status: StatusModeracao } | null;
  avaliacoes: AvaliacaoVendedor[]; // publicadas, sem a do próprio aluno
}

// Resultado de enviar pergunta, resposta ou avaliação pelas rotas /api
export interface ResultadoModeracao {
  id: number | null; // null quando a moderação recusou (nada é gravado)
  status: StatusModeracao;
  mensagem: string;
}

export type TipoConteudoModerado = "pergunta" | "resposta" | "avaliacao";

export interface ConteudoModeracao {
  tipo: TipoConteudoModerado;
  id: number;
  texto: string | null;
  status: StatusModeracao;
  criado_em: string;
  autor_nome: string | null;
  autor_email: string | null;
  contexto: string;
  nota: number | null;
  link: string;
}

// Chat (migração 26): mensagens pelo Supabase Realtime (Broadcast) gravadas por RPC
export interface MensagemChat {
  id: number;
  conversa_id: string;
  autor_id: number;
  texto: string;
  cliente_id: string; // gerado no navegador; reenvio não duplica
  criado_em: string;
  lida_em: string | null;
}

export interface ConversaResumo {
  id: string;
  papel: "comprador" | "vendedor";
  produto: { id: number | null; nome: string; imagem_url: string | null; preco: number | null };
  outro: { loja_id: number; nome: string; avatar_url: string | null; slug: string | null; ativo: boolean };
  ultima: { texto: string; minha: boolean; criado_em: string } | null;
  nao_lidas: number;
  bloqueada: boolean;
  bloqueada_por_mim: boolean;
  ultima_mensagem_em: string;
}

export interface ConversaLeitura extends ConversaResumo {
  meu_id: number;
  mensagens: MensagemChat[];
  tem_mais: boolean;
}

// Cópia da conversa guardada na denúncia (só o admin lê, e cada leitura fica registrada)
export interface ConversaDenunciada {
  participantes: {
    usuario_id: number;
    papel: "comprador" | "vendedor";
    nome: string;
    email: string;
    nome_publico: string | null;
  }[];
  mensagens: { id: number; autor_id: number; texto: string; criado_em: string }[];
  mensagem_denunciada_id: number;
  copiada_em: string;
}

// Suporte (migração 31): chamados do aluno com a equipe. O aluno nunca vê qual admin respondeu (só de_equipe).
export type CategoriaChamado = "conta" | "acesso" | "anuncio" | "negociacao" | "privacidade" | "outro";
export type StatusChamado = "aberto" | "em_atendimento" | "resolvido";

export interface MensagemChamado {
  id: number;
  chamado_id: string;
  de_equipe: boolean;
  texto: string;
  cliente_id: string; // gerado no navegador; reenvio não duplica
  criado_em: string;
  lida_em: string | null;
}

export interface ChamadoResumo {
  id: string;
  protocolo: string;
  categoria: CategoriaChamado;
  assunto: string;
  status: StatusChamado;
  criado_em: string;
  atualizado_em: string;
  resolvido_em: string | null;
  ultima: { texto: string; de_equipe: boolean; criado_em: string } | null;
  nao_lidas: number; // do outro lado (aluno: da equipe; equipe: do aluno)
}

export interface ChamadoLeitura extends ChamadoResumo {
  mensagens: MensagemChamado[];
}

export interface AlunoDoChamado {
  id: number;
  nome: string;
  nome_publico: string | null;
  slug: string | null;
  instituicao: string | null;
  conta_status: string;
  bloqueado_ate: string | null;
}

export interface ChamadoAdmin extends ChamadoResumo {
  aluno: AlunoDoChamado | null;
}

// Página de uma lista do admin (migrações 34 e 35): total é o do filtro e da busca atuais
export interface PaginaAdmin<T> {
  itens: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface FilaChamadosAdmin extends PaginaAdmin<ChamadoAdmin> {
  contagens: Record<StatusChamado | "todos", number>;
}

export type FiltroContas = "todas" | "ativa" | "suspensa" | "bloqueada" | "denuncias";

export interface ContasPagina extends PaginaAdmin<UsuarioModeracao> {
  contagens: Record<FiltroContas, number>; // com a busca aplicada
}

export interface LojasPagina extends PaginaAdmin<LojaModeracao> {
  contagens: Record<LojaStatus | "todos", number>; // com a busca aplicada
}

export interface ProdutosPagina extends PaginaAdmin<ProdutoModeracao> {
  total_destaques: number; // de todo o site
}

export interface ChamadoAdminLeitura extends ChamadoAdmin {
  mensagens: MensagemChamado[];
}
