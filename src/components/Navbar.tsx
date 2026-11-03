import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { contarMensagensNaoLidas, getResumoUsuarioNavbar } from "@/lib/queries";
import { assinarUsuario } from "@/lib/chat-realtime";
import { PAGINAS_PAINEL } from "@/lib/painel-routes";
import Logo from "@/components/Logo";
import { logoDaFaculdade, nomeCurtoFaculdade } from "@/lib/faculdades";
import { Flag, Image as ImageIcon, LifeBuoy, LogOut, MessageCircle, MessageSquare, Plus, Store, UserRound, Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";

// Menu da conta: seção "Minha conta" (todo aluno) e "Administração" (só admin)
const TITULO_SECAO = "px-4 pt-3 pb-1 text-xs text-tinta-sutil uppercase font-bold tracking-wider";
const ITEM_MENU = "flex items-center gap-2.5 px-4 py-2 text-sm font-semibold text-tinta hover:bg-pagina transition";
const PAGINAS_ADMIN = [
  { href: "/admin/suporte", label: "Suporte", icon: LifeBuoy },
  { href: "/admin/contas", label: "Contas", icon: Users },
  { href: "/admin/denuncias", label: "Denúncias", icon: Flag },
  { href: "/admin/comentarios", label: "Comentários", icon: MessageSquare },
  { href: "/admin/lojas", label: "Perfis e impulsionados", icon: Store },
  { href: "/admin/imagens", label: "Imagens", icon: ImageIcon },
];

export default function Navbar() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [menuAberto, setMenuAberto] = useState(false);

  // Campus fixo do aluno (vem do domínio do e-mail; não há seletor)
  const [campusNome, setCampusNome] = useState<string | null>(null);
  const [campusLogo, setCampusLogo] = useState<string | null>(null);
  const [lojaId, setLojaId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Chat: id do aluno (canal usuario:{id}) e mensagens não lidas
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [naoLidas, setNaoLidas] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);

  // Carregar dados da sessão do usuário
  useEffect(() => {
    async function fetchUserData(authId?: string) {
      if (!authId) return;
      const data = await getResumoUsuarioNavbar().catch(() => null);

      if (data) {
        setIsAdmin(data.is_admin);
        // Perfil com nome de exibição (marca) aparece com ele; senão, o nome pessoal
        setNomeUsuario(data.nome_exibicao || data.nome);
        setCampusNome(data.instituicao_nome);
        setCampusLogo(logoDaFaculdade(data.instituicao_dominios));
        setLojaId(data.loja_id);
        setAvatarUrl(data.avatar_url);
        setUsuarioId(data.usuario_id);

        // Sem campus (e-mail de faculdade não participante): onboarding explica e oferece a troca
        const isAuthPage =
          router.pathname === "/login" ||
          router.pathname === "/cadastro" ||
          router.pathname === "/onboarding" ||
          router.pathname === "/confirmar-email" ||
          router.pathname === "/painel/perfil";

        if (!data.instituicoes_id && !isAuthPage) {
          router.push("/onboarding");
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) fetchUserData(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        fetchUserData(session.user.id);
      } else {
        setIsAdmin(false);
        setNomeUsuario("");
        setCampusNome(null);
        setCampusLogo(null);
        setLojaId(null);
        setAvatarUrl(null);
        setUsuarioId(null);
        setNaoLidas(0);
      }
    });

    // Fechar menus ao clicar fora
    function handleClickFora(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickFora);
    };
  }, [router]);

  // Contador de não lidas: carrega ao entrar e a cada navegação; o Realtime avisa de mensagem nova
  // e de conversa lida (inclusive em outra aba)
  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    const recontar = () =>
      contarMensagensNaoLidas()
        .then((n) => ativo && setNaoLidas(n))
        .catch(() => undefined);
    recontar();
    const canal = assinarUsuario(usuarioId, {
      onNovaMensagem: (m) => {
        if (m.autor_id !== usuarioId) recontar();
      },
      onConversaLida: recontar,
    });
    router.events.on("routeChangeComplete", recontar);
    return () => {
      ativo = false;
      canal.sair();
      router.events.off("routeChangeComplete", recontar);
    };
  }, [usuarioId, router.events]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setMenuAberto(false);
    router.push("/login");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = termo.trim();

    const params = new URLSearchParams();
    if (q) params.set("q", q);

    router.push(`/listagem?${params.toString()}`);
    setTermo("");
  }

  return (
    <header className="bg-superficie border-b border-borda sticky top-0 z-30">
      {/* Os logos (Circular e faculdade) nunca encolhem: quem cede espaço é a busca e depois o nome.
          Até md: duas linhas (logos + ações em cima, busca embaixo). A partir de md: uma linha, com os
          lados de peso igual para a busca ficar no centro da página enquanto couber. */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 md:gap-x-4">
        {/* Circular | logo da faculdade do aluno */}
        <div className="flex items-center gap-3 shrink-0 md:flex-1 md:basis-0">
          <Link
            href="/"
            aria-label="Circular — página inicial"
            className="shrink-0 rounded-controle focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
          >
            <span className="hidden sm:block">
              <Logo />
            </span>
            <span className="sm:hidden">
              <Logo variante="simbolo" />
            </span>
          </Link>

          {user && campusNome && (
            <div title={`Seu campus: ${campusNome}`} className="flex items-center gap-3 shrink-0">
              <span className="h-7 border-l border-borda" aria-hidden="true" />
              {campusLogo ? (
                <img
                  src={campusLogo}
                  alt={`Seu campus: ${campusNome}`}
                  className="h-6 sm:h-7 w-auto max-w-none shrink-0"
                />
              ) : (
                // Sem logo: nome curto (sigla); nome longo sem sigla trunca para não empurrar as ações
                <span className="text-sm font-semibold text-tinta-suave truncate max-w-28 sm:max-w-40">
                  <span className="sr-only">Seu campus: </span>
                  {nomeCurtoFaculdade(campusNome)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Busca no catálogo do campus (só logados); no celular vai para a segunda linha */}
        {user ? (
          <form
            onSubmit={handleSubmit}
            className="order-last basis-full md:order-none md:grow-0 md:shrink md:basis-xl md:min-w-40"
            role="search"
          >
            <input
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder={campusNome ? "Buscar no seu campus" : "Buscar"}
              aria-label="Buscar anúncios do seu campus"
              className="w-full rounded-pill border border-borda-controle focus:border-petroleo focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2 px-4 py-2 min-h-[44px] text-sm text-tinta placeholder:text-tinta-sutil transition bg-superficie"
            />
          </form>
        ) : null}

        {/* Ações e Menu do Usuário */}
        <div className="ml-auto min-w-0 flex items-center justify-end gap-2 sm:gap-3 md:flex-1 md:basis-0 md:min-w-auto">

          {user && (
            <Link
              href="/anunciar"
              aria-label="Anunciar"
              className="inline-flex items-center gap-1.5 bg-acao hover:bg-acao-hover text-white text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-controle transition shrink-0 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
            >
              <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
              {/* Entre md e lg a linha única fica apertada: só o ícone, para a busca ter espaço */}
              <span className="hidden sm:inline md:hidden lg:inline">Anunciar</span>
            </Link>
          )}

          {user && (
            <Link
              href="/mensagens"
              aria-label={naoLidas > 0 ? `Mensagens: ${naoLidas} não lidas` : "Mensagens"}
              className="relative w-11 h-11 inline-flex items-center justify-center rounded-controle text-petroleo hover:bg-petroleo-50 transition shrink-0 focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
            >
              <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
              {naoLidas > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-pill bg-acao text-white text-[11px] font-bold leading-[18px] text-center"
                >
                  {naoLidas > 99 ? "99+" : naoLidas}
                </span>
              )}
            </Link>
          )}

          {/* Menu do Usuário */}
          <div className="relative min-w-0" ref={menuRef}>
            {user ? (
              <>
                {/* Foto | Nome: o nome encolhe conforme a tela (e trunca com "…"); na tela mais estreita fica só a inicial */}
                <button
                  type="button"
                  onClick={() => setMenuAberto(!menuAberto)}
                  aria-label="Menu da conta"
                  aria-expanded={menuAberto}
                  className={`flex items-center gap-2 min-w-0 max-w-full min-h-[44px] rounded-pill border border-borda-controle hover:border-petroleo transition bg-superficie p-0.5 ${nomeUsuario ? "min-[420px]:pr-3" : ""} focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2`}
                >
                  <span className="w-10 h-10 rounded-pill bg-petroleo-50 flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-petroleo" aria-hidden="true">
                        {(nomeUsuario || user.email || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  {nomeUsuario && (
                    <span className="hidden min-[420px]:block min-w-0 text-sm font-semibold text-tinta truncate max-w-20 sm:max-w-32 md:max-w-20 lg:max-w-28 xl:max-w-40">
                      {nomeUsuario}
                    </span>
                  )}
                </button>

                {menuAberto && (
                  <div className="absolute right-0 mt-2 w-56 bg-superficie border border-borda rounded-card shadow-flutuante py-2 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-borda">
                      <p className="text-sm font-semibold text-tinta truncate">{nomeUsuario || user.email}</p>
                    </div>

                    {/* Funções de todo aluno */}
                    <p className={TITULO_SECAO}>Minha conta</p>
                    {Object.values(PAGINAS_PAINEL).map((pagina) => (
                      <Link
                        key={pagina.id}
                        href={pagina.href}
                        onClick={() => setMenuAberto(false)}
                        className={ITEM_MENU}
                      >
                        <pagina.icon size={18} strokeWidth={1.75} className="text-tinta-suave" aria-hidden="true" />
                        <span>{pagina.label}</span>
                      </Link>
                    ))}
                    {lojaId && (
                      <Link href={`/perfil/${lojaId}`} onClick={() => setMenuAberto(false)} className={ITEM_MENU}>
                        <UserRound size={18} strokeWidth={1.75} className="text-tinta-suave" aria-hidden="true" />
                        <span>Ver perfil público</span>
                      </Link>
                    )}

                    {/* Só para a equipe (as páginas também exigem is_admin no middleware e no banco) */}
                    {isAdmin && (
                      <div className="border-t border-borda mt-1">
                        <p className={TITULO_SECAO}>Administração</p>
                        {PAGINAS_ADMIN.map((pagina) => (
                          <Link
                            key={pagina.href}
                            href={pagina.href}
                            onClick={() => setMenuAberto(false)}
                            className={ITEM_MENU}
                          >
                            <pagina.icon size={18} strokeWidth={1.75} className="text-petroleo" aria-hidden="true" />
                            <span>{pagina.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-borda mt-1 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-sm text-perigo hover:bg-perigo-50 transition"
                      >
                        <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
                        <span>Sair</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-3">
                <Link
                  href="/login"
                  className="text-petroleo hover:underline text-sm font-semibold transition px-2 min-h-[44px] inline-flex items-center"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="hidden sm:inline-flex bg-superficie text-petroleo border border-borda-controle hover:border-petroleo px-4 py-2.5 min-h-[44px] items-center rounded-controle text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-petroleo focus-visible:outline-offset-2"
                >
                  Cadastrar
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
