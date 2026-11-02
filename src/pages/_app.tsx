import "@/styles/globals.css";
import { useEffect } from "react";
import type { AppProps } from "next/app";
import { Plus_Jakarta_Sans } from "next/font/google";
import Head from "next/head";
import Script from "next/script";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { tituloDaRota } from "@/lib/titulos";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-jakarta",
});

// Google AdSense só no host de produção (espelho de HOST_ANUNCIOS em next.config.ts, que libera a CSP só lá)
const HOST_ANUNCIOS = "circular.eokinha.com.br";
const ADSENSE_CLIENT = "ca-pub-6802793038302446";

export default function App({ Component, pageProps, router }: AppProps) {
  // Decidido no cliente: o HTML do servidor é o mesmo em qualquer host (previews da Vercel ficam sem anúncios)
  useEffect(() => {
    if (window.location.hostname !== HOST_ANUNCIOS || document.getElementById("google-adsense")) return;
    const script = document.createElement("script");
    script.id = "google-adsense";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(script);
  }, []);

  return (
    <div className={`${jakarta.variable} font-sans min-h-screen flex flex-col bg-pagina text-tinta`}>
      {/* Título padrão da rota; o <title> da própria página (anúncio, perfil, painel) tem prioridade */}
      <Head>
        <title>{tituloDaRota(router.pathname)}</title>
        {/* Favicon: símbolo branco sobre petróleo (fonte: public/icon.svg; .ico e apple-touch gerados a partir dele) */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      {/* Google Analytics (GA4) */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-7HJT8QR82M"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-7HJT8QR82M');
        `}
      </Script>
      <Navbar />
      <main className="flex-1">
        <Component {...pageProps} />
      </main>
      <Footer />
    </div>
  );
}
