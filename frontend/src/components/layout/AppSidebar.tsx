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
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { useQuery } from "@tanstack/react-query";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { SinalDadosNovos } from "@/components/shared/SinalDadosNovos";
import { itemAtivo, itemPermitido, navGrupos } from "@/lib/navigation-config";

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  // O menu mostra só o que o perfil do usuário alcança (Passo 22). Sem o Mês em Trabalho (13/10/2026): o mês se abre
  // em Fechamento Mensal.
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar(), enabled: !!user });
  const itens = competencias.data?.itens ?? [];
  // Bola verde em "Competências" quando algum mês recebeu dados importados de outro mês e ainda não foi reapurado.
  const algumComDadosNovos = itens.some((c) => c.dadosNovos);
  // Os grupos de telas aparecem como um item só, que abre na primeira tela alcançada.
  const grupos = navGrupos
    .map((g) => ({ ...g, itens: g.itens.map((i) => itemPermitido(i, hasPermission)).filter((i) => i !== null) }))
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
                <span className="truncate text-xs text-sidebar-foreground/70">SIG · Controladoria</span>
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
                    {/* A tela ativa em amarelo-ouro e negrito, em todos os temas, também com o mouse em cima (14/10/2026); as demais, o realce cinza ao passar o mouse. */}
                    <SidebarMenuButton
                      isActive={itemAtivo(pathname, item)}
                      tooltip={item.title}
                      render={<Link href={item.href} />}
                      className="data-active:bg-bpm-primary data-active:font-bold data-active:text-black data-active:hover:bg-bpm-primary data-active:hover:text-black"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {item.href === "/competencias" && algumComDadosNovos ? <SinalDadosNovos titulo="Há meses com entradas alteradas depois da apuração: reapure" /> : null}
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
