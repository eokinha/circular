import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Origem do Supabase (API, Auth, Storage e Realtime). Sem a variável na build, aceita qualquer projeto.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") || "https://*.supabase.co";
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");

// Imagens de demonstração (SecaoTrocas) e avatar do modo ?preview=1 (só dev)
const imagensExternas = ["https://images.unsplash.com", ...(isDev ? ["https://api.dicebear.com"] : [])];

// Google Analytics (GA4, _app.tsx): domínios exigidos pelo gtag
const googleTag = "https://*.googletagmanager.com";
const googleAnalytics = "https://*.google-analytics.com https://*.analytics.google.com";

// Google AdSense (ads.txt em public/): liberado SÓ no host de produção abaixo; previews da Vercel,
// localhost e outros domínios seguem sem anúncios na CSP
const HOST_ANUNCIOS = "circular.eokinha.com.br";
const adsense = {
  script:
    "https://pagead2.googlesyndication.com https://*.googlesyndication.com https://partner.googleadservices.com " +
    "https://www.googletagservices.com https://adservice.google.com https://*.adtrafficquality.google",
  frame:
    "https://googleads.g.doubleclick.net https://*.googlesyndication.com https://www.google.com " +
    "https://*.adtrafficquality.google",
  img: "https://*.googlesyndication.com https://*.g.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google",
  connect: "https://*.googlesyndication.com https://*.g.doubleclick.net https://*.google.com https://*.adtrafficquality.google",
};

function montarCsp(comAnuncios: boolean): string {
  const ads = (fontes: string) => (comAnuncios ? ` ${fontes}` : "");
  return [
    "default-src 'self'",
    // 'unsafe-eval' só no dev (React Refresh); 'unsafe-inline' cobre os scripts inline que o Next injeta
    // (bootstrap do Turbopack e o snippet do gtag)
    `script-src 'self' 'unsafe-inline' ${googleTag}${ads(adsense.script)}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseUrl} ${imagensExternas.join(" ")} ${googleTag} ${googleAnalytics}${ads(adsense.img)}`,
    "font-src 'self' data:",
    // api.pwnedpasswords.com: checagem de senha vazada (src/lib/senha-vazada.ts)
    `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://api.pwnedpasswords.com ${googleTag} ${googleAnalytics}${ads(adsense.connect)}${isDev ? " ws://localhost:*" : ""}`,
    ...(comAnuncios ? [`frame-src 'self' ${adsense.frame}`] : []),
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

const headersSeguranca = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

// Cache (ver src/lib/cache.ts). Cloudflare-CDN-Cache-Control só vale para o Cloudflare, que não o repassa.
// Páginas estáticas: o mesmo HTML para todos; o cabeçalho sai só sem cookie de sessão do Supabase
// (espelho de PADRAO_COOKIE_SESSAO), e o deploy limpa o cache (.github/workflows/limpar-cache-cloudflare.yml)
const PAGINAS_ESTATICAS_PUBLICAS = ["/termos", "/privacidade", "/esqueci-senha"];
const semSessao = [{ type: "header" as const, key: "cookie", value: ".*sb-[^=;]+-auth-token.*" }];
const cachePaginaEstatica = [
  { key: "Cloudflare-CDN-Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
];
// Arquivos de public/ sem hash no nome: 1 dia de cache; depois serve a cópia enquanto confere (até 7 dias)
const ARQUIVOS_PUBLICOS = ["/hero/:path*", "/brand/:path*", "/faculdades/:path*", "/icon.svg", "/favicon.ico", "/apple-touch-icon.png"];
const cacheArquivoPublico = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const hostAnuncios = [{ type: "host" as const, value: HOST_ANUNCIOS }];
    return [
      {
        source: "/:path*",
        has: hostAnuncios,
        headers: [{ key: "Content-Security-Policy", value: montarCsp(true) }, ...headersSeguranca],
      },
      {
        source: "/:path*",
        missing: hostAnuncios,
        headers: [{ key: "Content-Security-Policy", value: montarCsp(false) }, ...headersSeguranca],
      },
      ...PAGINAS_ESTATICAS_PUBLICAS.map((source) => ({ source, missing: semSessao, headers: cachePaginaEstatica })),
      ...ARQUIVOS_PUBLICOS.map((source) => ({ source, headers: cacheArquivoPublico })),
    ];
  },
};

export default nextConfig;
