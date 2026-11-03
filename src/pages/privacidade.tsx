import Head from "next/head";
import { EMAIL_SUPORTE, linkMailtoSuporte } from "@/lib/suporte";

export default function PrivacidadePage() {
  return (
    <>
      <Head>
        <title>Política de Privacidade • Circular</title>
      </Head>

      <article className="max-w-3xl mx-auto px-4 py-10 text-tinta">
        <h1 className="text-3xl font-bold text-petroleo tracking-tight">Política de Privacidade</h1>
        <p className="text-sm text-tinta-suave mt-2">Última atualização: novembro de 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">1. Quais dados coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cadastro: nome, sobrenome, e-mail e senha (guardada de forma criptografada).</li>
              <li>Verificação: instituição e número de matrícula.</li>
              <li>Perfil: WhatsApp (opcional), descrição, fotos, redes sociais e locais de encontro que você informar.</li>
              <li>Mensagens do chat que você enviar e receber.</li>
              <li>
                Chamados de suporte: o assunto, as mensagens trocadas com a equipe e os e-mails de atendimento enviados a
                você (protocolo, respostas e encerramento).
              </li>
              <li>Registros de acesso: endereço IP, data e hora em que você entra, usa o chat e abre ou responde chamados.</li>
              <li>Anúncios, favoritos e denúncias que você criar.</li>
              <li>
                Registro de interesse: quando você toca em &ldquo;Tenho interesse&rdquo;, guardamos qual anúncio e quando, para
                medir o uso da plataforma.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">2. Para que usamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmar que você é aluno de uma instituição atendida.</li>
              <li>Mostrar seus anúncios e seu perfil para outros alunos.</li>
              <li>Permitir que alunos logados falem com você pelo chat e, se você cadastrar, pelo WhatsApp.</li>
              <li>Cumprir a obrigação legal de guardar registros de acesso (Marco Civil da Internet, art. 15).</li>
              <li>Moderar denúncias, perguntas e avaliações e manter a comunidade segura.</li>
              <li>
                Atender seus pedidos de suporte e mandar ao e-mail da sua conta o registro do atendimento (protocolo,
                aviso de resposta e resumo no encerramento).
              </li>
              <li>Medir o uso do serviço de forma agregada.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">3. O que fica público</h2>
            <p>
              Seu nome, instituição, selo de verificado, fotos, descrição e anúncios aparecem para quem visita o
              catálogo, assim como as perguntas e avaliações que você publicar (com seu nome público). Seu WhatsApp, se cadastrado, só é mostrado para alunos com conta, quando eles pedem para falar com você.
              As mensagens do chat só são vistas por você e pela outra pessoa da conversa. A equipe só lê uma conversa
              quando uma das pessoas denuncia uma mensagem, e cada leitura fica registrada. Os chamados de suporte só são
              vistos por você e pela equipe do Circular.
              E-mail, matrícula, CPF e telefone de cadastro nunca ficam públicos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">4. Com quem compartilhamos</h2>
            <p>
              Não vendemos seus dados. Usamos fornecedores para hospedar o site, o banco de dados e o envio de e-mails
              (inclusive os de atendimento do suporte, que levam seu e-mail, seu nome e o texto do chamado),
              que tratam os dados só para prestar esse serviço. O texto de perguntas, respostas e comentários de
              avaliação é enviado a um serviço de moderação automática (Vettly), sem seu nome, e-mail ou telefone,
              só para checar se segue as regras antes de publicar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">5. Por quanto tempo guardamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Conversas do chat: apagadas 30 dias depois da última mensagem.</li>
              <li>
                Chamados de suporte: apagados 180 dias depois de resolvidos, para a equipe consultar o histórico se o
                mesmo problema voltar ou se você pedir revisão. Os e-mails de atendimento ficam na sua caixa de entrada.
              </li>
              <li>
                Conta excluída: tudo sai do site na hora. Uma cópia do conteúdo (perfil, anúncios, perguntas, avaliações,
                conversas e chamados de suporte) fica guardada fora do site por 30 dias, para segurança e pedidos de autoridades, e depois é
                apagada.
              </li>
              <li>Conversa denunciada: a cópia enviada à equipe fica até a denúncia ser analisada e mais 30 dias.</li>
              <li>Registros de acesso (IP, data e hora): 6 meses, o prazo mínimo do Marco Civil da Internet.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">6. Seus direitos (LGPD)</h2>
            <p>
              Você pode acessar e corrigir seus dados no painel e excluir sua conta a qualquer momento em Painel →
              Perfil → Excluir conta. A exclusão tira do site seu perfil, anúncios, fotos, favoritos, conversas e chamados, com a
              retenção descrita acima. Denúncias feitas sobre você podem ser mantidas, sem vínculo com sua conta, para
              segurança da comunidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-petroleo mb-2">7. Contato</h2>
            <p>
              Dúvidas e pedidos sobre seus dados: abra um chamado em Painel → Suporte (assunto &ldquo;Meus dados&rdquo;) ou
              escreva para{" "}
              <a href={linkMailtoSuporte("Meus dados no Circular")} className="text-petroleo font-semibold hover:underline">
                {EMAIL_SUPORTE}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
