import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Building2,
  CalendarDays,
  FileText,
  Globe,
  LayoutDashboard,
  ListTree,
  Package,
  Shuffle,
  Table2,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export const navPrincipal: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Competências", href: "/competencias", icon: CalendarDays },
  { title: "Centros de custo", href: "/cadastros/centros-custo", icon: Building2 },
  {
    title: "Contas de resultado",
    href: "/cadastros/contas-resultado",
    icon: Table2,
  },
  { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree },
  { title: "Reclassificações", href: "/cadastros/reclassificacoes", icon: Shuffle },
  { title: "Preços do contrato", href: "/cadastros/precos-contrato", icon: BadgeDollarSign },
];

export const navReferencias: NavItem[] = [
  { title: "Pedidos", href: "/pedidos/listagem", icon: Package },
  { title: "Formulário", href: "/exemplo/formulario", icon: FileText },
  { title: "Landing", href: "/exemplo/landing", icon: Globe },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/competencias": "Competências",
  "/cadastros/centros-custo": "Centros de custo",
  "/cadastros/contas-resultado": "Contas de resultado",
  "/cadastros/estrutura-dre": "Estrutura da DRE",
  "/cadastros/reclassificacoes": "Reclassificações de conta",
  "/cadastros/precos-contrato": "Preços do contrato",
  "/pedidos/listagem": "Pedidos",
  "/exemplo/formulario": "Formulário",
};

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(`${path}/`),
  );
  return match?.[1] ?? "Área restrita";
}
