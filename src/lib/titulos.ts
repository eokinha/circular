// Título da aba por rota (aplicado no _app). Páginas com título dinâmico (anúncio, perfil, painel,
// anunciar) definem o próprio <title>, que tem prioridade. Rota nova: adicionar aqui.
export const TITULO_PADRAO = "Circular • Compre e troque com colegas do seu campus";

const TITULOS_POR_ROTA: Record<string, string> = {
  "/": TITULO_PADRAO,
  "/listagem": "Anúncios do seu campus • Circular",
  "/login": "Entrar • Circular",
  "/cadastro": "Criar conta • Circular",
  "/esqueci-senha": "Recuperar senha • Circular",
  "/redefinir-senha": "Nova senha • Circular",
  "/confirmar-email": "Confirmar e-mail • Circular",
  "/onboarding": "Boas-vindas • Circular",
  "/anunciar": "Anunciar • Circular",
  "/ajuda": "Ajuda • Circular",
  "/termos": "Termos de Uso • Circular",
  "/privacidade": "Política de Privacidade • Circular",
  "/painel": "Painel • Circular",
  "/painel/suporte": "Suporte • Circular",
  "/mensagens": "Mensagens • Circular",
  "/admin/contas": "Contas • Admin Circular",
  "/admin/lojas": "Lojas e destaques • Admin Circular",
  "/admin/imagens": "Imagens • Admin Circular",
  "/admin/denuncias": "Denúncias • Admin Circular",
  "/admin/comentarios": "Comentários • Admin Circular",
  "/admin/suporte": "Suporte • Admin Circular",
  "/404": "Página não encontrada • Circular",
};

// Recebe router.pathname (ex.: "/anuncio/[id]"); rota sem título próprio fica com o padrão
export function tituloDaRota(pathname: string): string {
  return TITULOS_POR_ROTA[pathname] ?? TITULO_PADRAO;
}
