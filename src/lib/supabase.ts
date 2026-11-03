import { createBrowserClient, createServerClient as createSupabaseServerClient, serializeCookieHeader } from "@supabase/ssr";
import { cookiesSessaoInvalidos } from "./cookies-sessao";
import { type GetServerSidePropsContext, type NextApiRequest, type NextApiResponse } from "next";

const getSupabaseEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, key };
};

/**
 * Cliente para uso no Browser (lado do cliente).
 */
export const createClient = () => {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key);
};

// Cliente singleton para uso rápido no browser (lazy initialization)
let _client: ReturnType<typeof createClient> | null = null;
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient();
    }
    return Reflect.get(_client, prop);
  },
});

/**
 * Cliente para uso no Servidor (getServerSideProps).
 * Cookie de sessão corrompido (ver cookies-sessao.ts) é ignorado e apagado na resposta, em vez de derrubar a página.
 */
export const createServerClient = (context: GetServerSidePropsContext) => {
  const { url, key } = getSupabaseEnv();
  const todos = Object.entries(context.req.cookies).map(([name, value]) => ({
    name,
    value: value ?? "",
  }));
  const ruins = new Set(cookiesSessaoInvalidos(todos));
  const validos = todos.filter(({ name }) => !ruins.has(name));
  const apagar = (exceto: Set<string>) =>
    [...ruins]
      .filter((name) => !exceto.has(name))
      .map((name) => serializeCookieHeader(name, "", { path: "/", maxAge: 0 }));

  if (ruins.size > 0) {
    context.res.setHeader("Set-Cookie", apagar(new Set()));
  }

  return createSupabaseServerClient(url, key, {
    cookies: {
      getAll() {
        return validos;
      },
      setAll(cookiesToSet) {
        // Acumula todos os cookies (a sessão pode vir dividida em chunks) e preserva as opções
        const gravados = new Set(cookiesToSet.map(({ name }) => name));
        context.res.setHeader("Set-Cookie", [
          ...apagar(gravados),
          ...cookiesToSet.map(({ name, value, options }) => serializeCookieHeader(name, value, options)),
        ]);
      },
    },
  });
};

/**
 * Cliente para rotas de API (src/pages/api): usa a sessão do aluno pelos cookies, como no getServerSideProps.
 */
export const createApiClient = (req: NextApiRequest, res: NextApiResponse) =>
  createServerClient({ req, res } as unknown as GetServerSidePropsContext);
