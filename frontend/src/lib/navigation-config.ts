import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Globe,
  LayoutDashboard,
  Package,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export const navPrincipal: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Pedidos", href: "/pedidos/listagem", icon: Package, badge: "4" },
];

export const navReferencias: NavItem[] = [
  { title: "Formulário", href: "/exemplo/formulario", icon: FileText },
  { title: "Landing", href: "/exemplo/landing", icon: Globe },
];

export const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
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
