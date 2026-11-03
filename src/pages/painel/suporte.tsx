import type { GetServerSideProps } from "next";
import PainelEstudante from "@/components/painel/PainelEstudante";
import { getPainelServerSideProps, type PainelProps } from "@/lib/painel-data";
import { createServerClient } from "@/lib/supabase";
import { getChamadoLeitura, getMeusChamados } from "@/lib/queries";
import type { ChamadoLeitura, ChamadoResumo } from "@/types";

type Props = PainelProps & { chamados: ChamadoResumo[]; chamadoAberto: ChamadoLeitura | null };

// Suporte do aluno (migração 31): também para conta suspensa ou bloqueada (o painel abre para ela)
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const painel = await getPainelServerSideProps(ctx);
  if (!("props" in painel)) return painel;
  const props = await painel.props;

  const serverSupabase = createServerClient(ctx);
  const id = typeof ctx.query.chamado === "string" ? ctx.query.chamado : null;
  const valido = id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Modo de pré-visualização (sem login, só em desenvolvimento): sem chamados
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  if (!user) return { props: { ...props, chamados: [], chamadoAberto: null } };

  const [chamados, chamadoAberto] = await Promise.all([
    getMeusChamados(serverSupabase),
    valido ? getChamadoLeitura(id, serverSupabase) : Promise.resolve(null),
  ]);
  if (id && !chamadoAberto) {
    return { redirect: { destination: "/painel/suporte", permanent: false } };
  }
  return { props: { ...props, chamados, chamadoAberto } };
};

export default function PaginaSuporte({ chamados, chamadoAberto, ...props }: Props) {
  return <PainelEstudante {...props} abaAtiva="suporte" suporte={{ chamados, chamadoAberto }} />;
}
