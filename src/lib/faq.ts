// Conteúdo do /ajuda. Cada pergunta tem um id que vira âncora (/ajuda#nao-chegou), para mandar o link direto.
// Respostas descrevem as regras do CLAUDE.md: ao mudar uma regra de negócio, revisar o texto aqui.
import { DIAS_VALIDADE_ANUNCIO } from "./anuncios.ts";
import { REMETENTE_CIRCULAR } from "./guias-email.ts";
import { EMAIL_SUPORTE } from "./suporte.ts";

export interface LinkFaq {
  href: string; // sempre caminho interno
  texto: string;
}

export interface PerguntaFaq {
  id: string;
  pergunta: string;
  resposta: string[]; // um parágrafo por item
  links?: LinkFaq[];
  guiaFaculdades?: boolean; // mostra o seletor "Sua faculdade" com o passo a passo do e-mail
}

export interface SecaoFaq {
  id: string;
  titulo: string;
  perguntas: PerguntaFaq[];
}

export const FAQ: SecaoFaq[] = [
  {
    id: "email-da-faculdade",
    titulo: "E-mail da faculdade",
    perguntas: [
      {
        id: "por-que-email-da-faculdade",
        pergunta: "Por que preciso do e-mail da faculdade?",
        resposta: [
          "O Circular é só entre alunos. O e-mail da faculdade mostra que você estuda lá e define o seu campus: você vê e negocia com colegas do mesmo campus.",
          "E-mails pessoais (Gmail, Hotmail etc.) não são aceitos no cadastro.",
        ],
      },
      {
        id: "acessar-email",
        pergunta: "Como descubro e acesso meu e-mail da faculdade?",
        resposta: [
          "Toda faculdade participante dá um e-mail institucional ao aluno. O endereço costuma aparecer no portal do aluno, no app da faculdade ou no e-mail de boas-vindas da matrícula.",
          "Escolha sua faculdade abaixo para ver como entrar.",
        ],
        guiaFaculdades: true,
      },
      {
        id: "primeiro-acesso",
        pergunta: "Nunca entrei no e-mail da faculdade. E agora?",
        resposta: [
          "Na maioria das faculdades, a senha do e-mail é a mesma do portal do aluno. No primeiro acesso, pode ser pedido para trocar a senha e cadastrar um celular para confirmar que é você.",
          "Se a senha não funcionar, peça para a secretaria ou o suporte de TI da faculdade redefinir. O Circular não tem acesso ao seu e-mail institucional.",
        ],
      },
      {
        id: "nao-chegou",
        pergunta: "O e-mail do Circular não chegou. O que eu faço?",
        resposta: [
          "Espere alguns minutos e confira a pasta de spam ou Lixo Eletrônico. No Outlook, veja também a aba Outros; no Gmail, as abas Promoções e Atualizações.",
          `Pesquise por "Circular" ou pelo remetente ${REMETENTE_CIRCULAR}.`,
          "Confira se o e-mail foi digitado certo. Na tela depois do cadastro dá para corrigir o endereço ou reenviar o link; no login, quem ainda não confirmou vê o botão Reenviar link de confirmação.",
          "Algumas faculdades seguram e-mails de fora antes de entregar. Se nada chegar depois de reenviar, peça ao suporte de TI da faculdade para liberar o remetente acima.",
        ],
        links: [{ href: "/login", texto: "Ir para o login" }],
      },
      {
        id: "link-invalido",
        pergunta: "O link de confirmação diz que é inválido ou expirou",
        resposta: [
          "Cada link funciona uma vez e por tempo limitado. Se você pediu mais de um, só o mais recente vale.",
          "Se você já confirmou, é só entrar. Se não, tente entrar com seu e-mail e senha: o login mostra o botão para reenviar o link.",
        ],
        links: [{ href: "/login", texto: "Ir para o login" }],
      },
      {
        id: "faculdade-fora",
        pergunta: "Minha faculdade não está no Circular",
        resposta: [
          "Por enquanto, só alunos das faculdades participantes conseguem se cadastrar. A lista aparece no seletor de faculdades acima e na página inicial.",
          "Estamos abrindo novas faculdades aos poucos.",
        ],
      },
    ],
  },
  {
    id: "conta",
    titulo: "Conta e senha",
    perguntas: [
      {
        id: "esqueci-senha",
        pergunta: "Esqueci minha senha",
        resposta: [
          "Em Esqueci minha senha, informe o e-mail da faculdade usado no cadastro. O link para criar uma nova senha chega nesse e-mail.",
          "Se ele não aparecer, siga as dicas de \"O e-mail do Circular não chegou\".",
        ],
        links: [{ href: "/esqueci-senha", texto: "Recuperar senha" }],
      },
      {
        id: "trocar-email",
        pergunta: "Como troco meu e-mail ou mudo de campus?",
        resposta: [
          "No painel, vá em Meus dados e depois em E-mail e campus. Enviamos um link para o novo e-mail; ao confirmar, seu campus passa a ser o da faculdade desse e-mail.",
          "Quando o campus muda, seus anúncios ativos são pausados. Reative-os no painel depois.",
        ],
        links: [{ href: "/painel/perfil#trocar-email", texto: "Abrir meus dados" }],
      },
      {
        id: "excluir-conta",
        pergunta: "Como excluo minha conta?",
        resposta: [
          "No painel, em Meus dados, use Excluir conta. Seu perfil, anúncios, favoritos, perguntas, avaliações e conversas saem do site na hora, e não dá para desfazer.",
          "Por segurança e obrigação legal, guardamos uma cópia desse conteúdo fora do site por 30 dias e depois apagamos. Os registros de acesso (IP, data e hora) ficam 6 meses, como exige o Marco Civil da Internet.",
        ],
        links: [{ href: "/painel/perfil", texto: "Abrir meus dados" }],
      },
    ],
  },
  {
    id: "verificacao",
    titulo: "Verificação",
    perguntas: [
      {
        id: "verificado",
        pergunta: "O que é o selo de verificado?",
        resposta: [
          "O selo mostra que a matrícula do aluno foi confirmada. Só alunos verificados podem anunciar.",
          "Com o e-mail da faculdade confirmado, informe sua matrícula no painel: na maioria dos casos a verificação é na hora. Quando não for, nossa equipe analisa.",
        ],
        links: [{ href: "/painel/perfil", texto: "Informar matrícula" }],
      },
    ],
  },
  {
    id: "comprar",
    titulo: "Comprar e trocar",
    perguntas: [
      {
        id: "como-comprar",
        pergunta: "Como compro ou troco um item?",
        resposta: [
          "No anúncio, toque em Tenho interesse para abrir uma conversa no chat do Circular com o vendedor, sem expor o telefone de ninguém. Se o vendedor cadastrou WhatsApp, o botão do WhatsApp também aparece. Preço, entrega e pagamento são combinados entre vocês.",
          "O Circular só conecta alunos: não tem carrinho, não recebe pagamentos e não faz entregas.",
        ],
      },
      {
        id: "outro-campus",
        pergunta: "Por que não consigo falar com um aluno de outro campus?",
        resposta: [
          "As negociações acontecem dentro do mesmo campus. Perfis de outro campus abrem só para leitura, sem chat, sem WhatsApp e sem favoritar.",
        ],
      },
      {
        id: "perguntas-no-anuncio",
        pergunta: "Posso tirar dúvidas antes de chamar o vendedor?",
        resposta: [
          "Sim. Na página do anúncio, escreva sua pergunta em Perguntas ao vendedor. O vendedor responde ali mesmo e todos os alunos do campus veem a resposta.",
          "Perguntas e respostas passam por uma moderação automática antes de aparecer. Não escreva telefone nem dados pessoais: o contato é pelo botão Tenho interesse, que abre o chat.",
        ],
      },
      {
        id: "avaliar-vendedor",
        pergunta: "Como funciona a avaliação do vendedor?",
        resposta: [
          "Depois de falar com um vendedor pelo Circular (no chat ou no WhatsApp), você pode dar uma nota de 1 a 5 no perfil dele, com comentário opcional. Cada aluno avalia um vendedor uma vez e pode atualizar a nota depois.",
          "A nota sem comentário vale na hora. O comentário passa pela moderação automática; o que for ofensivo ou suspeito não é publicado.",
          "Você pode apagar sua pergunta ou avaliação quando quiser. Viu um comentário ofensivo ou suspeito de outra pessoa? Toque em Denunciar embaixo dele.",
        ],
      },
      {
        id: "chat",
        pergunta: "Como funciona o chat?",
        resposta: [
          "Cada anúncio tem a sua conversa entre você e quem anunciou. As mensagens chegam na hora, e o ícone de mensagens no topo mostra quantas você ainda não leu.",
          "O chat não passa por moderação automática. Se alguém for ofensivo, insistente ou suspeito, toque em Denunciar embaixo da mensagem: a equipe recebe uma cópia da conversa até aquele momento e só lê conversas denunciadas.",
          "No menu da conversa você pode bloquear (ninguém envia mais nada ali) ou apagar a conversa da sua lista.",
          "Conversas sem mensagem nova há 30 dias são apagadas automaticamente.",
        ],
        links: [{ href: "/mensagens", texto: "Abrir minhas mensagens" }],
      },
      {
        id: "negociar-com-seguranca",
        pergunta: "Como negociar com segurança?",
        resposta: [
          "Combine a entrega em um lugar movimentado do campus, em horário de aula.",
          "Veja o item funcionando antes de pagar e desconfie de quem pede pagamento adiantado ou tem pressa demais.",
          "Viu algo estranho? Denuncie o anúncio, o perfil ou a mensagem do chat.",
        ],
      },
    ],
  },
  {
    id: "anunciar",
    titulo: "Anunciar",
    perguntas: [
      {
        id: "como-anunciar",
        pergunta: "O que preciso para anunciar?",
        resposta: [
          "Ter a matrícula verificada. Depois é só tocar em Anunciar, adicionar foto, descrição e preço.",
          "Os colegas falam com você pelo chat do Circular. O WhatsApp no perfil é opcional: deixe em branco se não quiser expor seu número.",
        ],
        links: [{ href: "/anunciar", texto: "Anunciar" }],
      },
      {
        id: "anuncio-sumiu",
        pergunta: "Meu anúncio sumiu ou foi pausado",
        resposta: [
          `Anúncios saem do catálogo depois de ${DIAS_VALIDADE_ANUNCIO} dias sem renovação. No painel, use Renovar; editar ou reativar o anúncio também renova.`,
          "Os anúncios também são pausados quando a verificação da matrícula cai ou quando você muda de campus.",
        ],
        links: [{ href: "/painel/anuncios", texto: "Ver meus anúncios" }],
      },
      {
        id: "anunciar-troca",
        pergunta: "Posso anunciar só para troca?",
        resposta: [
          "Pode. Marque que aceita troca: um anúncio só de troca pode ficar com preço zero.",
        ],
      },
      {
        id: "nome-de-exibicao",
        pergunta: "Posso anunciar com o nome de uma marca em vez do meu nome?",
        resposta: [
          "Pode. Em Painel → Meus dados, preencha \"Nome de exibição\" (ex.: Bia Doces). Ele aparece no lugar do seu nome nos anúncios, no perfil e no QR code.",
          "Seu nome e sobrenome continuam na conta e a equipe do Circular sempre vê quem é o aluno por trás do perfil. Quem falar com você pelo WhatsApp vê o seu perfil de lá; pelo chat, só o nome público.",
          "Não vale usar termos que imitem a equipe do site, como Circular, Admin, Suporte ou Oficial. Para voltar a aparecer com seu nome, é só apagar o campo.",
        ],
        links: [{ href: "/painel/perfil", texto: "Abrir meus dados" }],
      },
      {
        id: "nome-de-usuario",
        pergunta: "Posso escolher o link do meu perfil?",
        resposta: [
          "Pode. Em Painel → Meus dados, preencha \"Nome de usuário\" (ex.: bia.doces). Seu perfil passa a abrir em /perfil/bia.doces, e o QR code usa esse link.",
          "Use de 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado. Depois da primeira escolha, dá para trocar uma vez a cada 30 dias.",
          "Links e QR codes antigos continuam levando ao seu perfil, e ninguém mais pode usar o nome que você deixou.",
        ],
        links: [{ href: "/painel/perfil", texto: "Abrir meus dados" }],
      },
      {
        id: "qr-code-loja",
        pergunta: "Como divulgo meu perfil com QR code?",
        resposta: [
          "No menu da conta, abra \"Ver perfil público\" e toque em \"Compartilhar meu perfil\". Dá para baixar o QR code em imagem, copiar o link ou mandar direto pelo WhatsApp.",
          "Viu o perfil de um colega e quer indicar? Toque em \"Compartilhar perfil\": é o mesmo QR code e o mesmo link.",
          "Quem escanear precisa entrar com o e-mail da faculdade para ver seus anúncios. Colegas do seu campus podem falar com você; alunos de outro campus só veem o perfil.",
        ],
        links: [{ href: "/painel", texto: "Ir para o painel" }],
      },
      {
        id: "compartilhar-anuncio",
        pergunta: "Como mando um anúncio para alguém?",
        resposta: [
          "Cada anúncio tem uma página própria. Abra o anúncio e toque em \"Compartilhar anúncio\": dá para copiar o link, mandar pelo WhatsApp ou baixar o QR code com a foto do item.",
          "No WhatsApp, o link aparece com a foto, o nome e o preço. Quem abrir precisa entrar com o e-mail da faculdade para ver o anúncio.",
        ],
      },
      {
        id: "itens-proibidos",
        pergunta: "O que não pode ser anunciado?",
        resposta: ["A lista de itens proibidos está nos Termos de Uso."],
        links: [{ href: "/termos", texto: "Ler os Termos de Uso" }],
      },
    ],
  },
  {
    id: "seguranca",
    titulo: "Denúncias",
    perguntas: [
      {
        id: "denunciar",
        pergunta: "Como denuncio um anúncio ou perfil?",
        resposta: [
          "Use o botão Denunciar no anúncio ou no perfil do aluno. Nossa equipe analisa cada denúncia e pode remover anúncios e bloquear contas.",
        ],
      },
    ],
  },
  {
    id: "suporte",
    titulo: "Falar com a equipe",
    perguntas: [
      {
        id: "falar-com-a-equipe",
        pergunta: "Como falo com a equipe do Circular?",
        resposta: [
          "Entre na sua conta e abra um chamado em Painel → Suporte. Você conversa com a equipe por ali e recebe no e-mail da faculdade o número do protocolo, o aviso de cada resposta e o resumo quando o atendimento termina.",
          "Vale também para conta suspensa ou bloqueada: o painel continua abrindo e você pode pedir a revisão por um chamado.",
          `Não consegue entrar (senha, e-mail da faculdade ou conta desativada)? Escreva para ${EMAIL_SUPORTE} usando o e-mail da faculdade, se tiver acesso a ele, e conte o que aparece na tela. Nunca envie sua senha.`,
        ],
        links: [{ href: "/painel/suporte", texto: "Abrir um chamado" }],
      },
    ],
  },
];
