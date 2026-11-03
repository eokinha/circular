import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { urlLogin } from "@/lib/avisos-login";
import { destinoCompartilhado } from "@/lib/compartilhar";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proteção de rotas
  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/cadastro") ||
    request.nextUrl.pathname.startsWith("/esqueci-senha");
  
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/minha-loja") ||
    request.nextUrl.pathname.startsWith("/admin");

  // Catálogo é só para logados, cada um no próprio campus (RLS, migração 19).
  // Visitante vai para o login e volta para a página que tentou abrir.
  const isCatalogo =
    request.nextUrl.pathname.startsWith("/listagem") ||
    request.nextUrl.pathname.startsWith("/perfil") ||
    request.nextUrl.pathname.startsWith("/anuncio") ||
    request.nextUrl.pathname.startsWith("/lojas");

  // Chat: visitante vai para o login e volta para a conversa
  if (!user && request.nextUrl.pathname.startsWith("/mensagens")) {
    const destino = request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(new URL(urlLogin("mensagens", destino), request.url));
  }

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!user && isCatalogo) {
    const destino = request.nextUrl.pathname + request.nextUrl.search;
    const aviso = destinoCompartilhado(destino)?.tipo ?? "catalogo";
    return NextResponse.redirect(new URL(urlLogin(aviso, destino), request.url));
  }

  // /admin exige usuarios.is_admin (as RPCs de moderação também checam no banco).
  // is_admin não é legível por select (migração 18): usa a RPC.
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos:
     * - _next/static e _next/image (arquivos do build e otimização de imagem)
     * - arquivos de public/ pela extensão (hero, brand, faculdades, ícones, ads.txt): sem sessão para checar,
     *   e passar pelo middleware impedia o cache deles na Vercel e no Cloudflare
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml|webmanifest)$).*)",
  ],
};
