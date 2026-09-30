"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BpmLogo } from "@/components/layout/BpmLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { usePermissions } from "@/context/PermissionContext";
import { navGrupos } from "@/lib/navigation-config";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  // O menu mostra só o que o perfil do usuário alcança (Passo 22).
  const grupos = navGrupos
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !i.permission || hasPermission(i.permission)) }))
    .filter((g) => g.itens.length > 0);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/competencias" />}>
              <BpmLogo className="h-7 w-auto" priority />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">BPM Pré-Moldados</span>
                <span className="truncate text-xs text-sidebar-foreground/70">SIG · Fechamento mensal</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {grupos.map((g) => (
          <SidebarGroup key={g.titulo}>
            <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.itens.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={isActivePath(pathname, item.href)} tooltip={item.title} render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge className="bg-bpm-primary text-black">{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
