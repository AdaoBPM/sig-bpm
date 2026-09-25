import type { LucideIcon } from "lucide-react";
import {
  Building2,
  FileText,
  Globe,
  LayoutDashboard,
  ListTree,
  Package,
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
  { title: "Centros de custo", href: "/cadastros/centros-custo", icon: Building2 },
  {
    title: "Contas de resultado",
    href: "/cadastros/contas-resultado",
    icon: Table2,
  },
  { title: "Estrutura da DRE", href: "/cadastros/estrutura-dre", icon: ListTree },
];

export const navReferencias: NavItem[] = [
  { title: "Pedidos", href: "/pedidos/listagem", icon: Package },
  { title: "Formulário", href: "/exemplo/formulario", icon: FileText },
  { title: "Landing", href: "/exemplo/landing", icon: Globe },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/cadastros/centros-custo": "Centros de custo",
  "/cadastros/contas-resultado": "Contas de resultado",
  "/cadastros/estrutura-dre": "Estrutura da DRE",
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
