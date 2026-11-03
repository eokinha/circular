import { Heart, LayoutDashboard, LifeBuoy, Package, User } from "lucide-react";

export const PAGINAS_PAINEL = {
  "visao-geral": {
    id: "visao-geral",
    href: "/painel",
    label: "Visão geral",
    title: "Meu painel",
    icon: LayoutDashboard,
  },
  anuncios: {
    id: "anuncios",
    href: "/painel/anuncios",
    label: "Meus anúncios",
    title: "Meus anúncios",
    icon: Package,
  },
  favoritos: {
    id: "favoritos",
    href: "/painel/favoritos",
    label: "Meus favoritos",
    title: "Meus favoritos",
    icon: Heart,
  },
  perfil: {
    id: "perfil",
    href: "/painel/perfil",
    label: "Meus dados",
    title: "Meus dados",
    icon: User,
  },
  suporte: {
    id: "suporte",
    href: "/painel/suporte",
    label: "Suporte",
    title: "Suporte",
    icon: LifeBuoy,
  },
} as const;

export type AbaPainel = keyof typeof PAGINAS_PAINEL;

export const ABAS_PAINEL = Object.keys(PAGINAS_PAINEL) as AbaPainel[];
