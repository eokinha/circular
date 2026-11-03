import Link from "next/link";
import Logo from "@/components/Logo";
import { linkMailtoSuporte } from "@/lib/suporte";

export default function Footer() {
  return (
    <footer className="bg-petroleo-900 text-white mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex flex-col items-center sm:items-start gap-1">
          <Logo cor="branco" />
          <p className="text-white/80">Circular. Economia no Campus.</p>
        </div>
        <nav aria-label="Ajuda e links legais" className="flex flex-wrap items-center justify-center gap-x-4 text-white/80">
          <span>© 2026 Circular</span>
          <Link href="/ajuda" className="hover:text-white hover:underline min-h-[44px] inline-flex items-center">
            Ajuda
          </Link>
          <a href={linkMailtoSuporte()} className="hover:text-white hover:underline min-h-[44px] inline-flex items-center">
            Fale com o suporte
          </a>
          <Link href="/termos" className="hover:text-white hover:underline min-h-[44px] inline-flex items-center">
            Termos de Uso
          </Link>
          <Link href="/privacidade" className="hover:text-white hover:underline min-h-[44px] inline-flex items-center">
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}
