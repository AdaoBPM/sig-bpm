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
import { CalendarClock } from "lucide-react";

import { competenciasService } from "@/app/competencias/services/competenciasService";
import { SinalDadosNovos } from "@/components/shared/SinalDadosNovos";
import { etapasDoMes, rotuloDoMes } from "@/lib/etapasDoMes";
import { itemAtivo, itemPermitido, navGrupos } from "@/lib/navigation-config";

export function AppSidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  // O menu mostra só o que o perfil do usuário alcança (Passo 22).
  // O mês em trabalho: o mais recente que não está fechado (ou o mais recente de todos).
  const competencias = useQuery({ queryKey: ["competencias", "todos"], queryFn: () => competenciasService.listar(), enabled: !!user });
  const itens = competencias.data?.itens ?? [];
  const emTrabalho = itens.find((c) => c.status !== "FECHADA") ?? itens[0];
  // Bola verde em "Competências" quando algum mês recebeu dados importados de outro mês e ainda não foi reapurado.
  const algumComDadosNovos = itens.some((c) => c.dadosNovos);
  const anoMes = emTrabalho ? `${emTrabalho.ano}-${String(emTrabalho.mes).padStart(2, "0")}` : null;
  const primeiraEtapa = etapasDoMes(hasPermission, user?.acesso)[0];
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
        {anoMes && primeiraEtapa ? (
          <SidebarGroup>
            <SidebarGroupLabel>Mês em Trabalho</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(`/competencias/${anoMes}`)}
                    tooltip={`Mês em Trabalho: ${rotuloDoMes(anoMes)}`}
                    render={<Link href={`/competencias/${anoMes}/${primeiraEtapa.caminho}`} />}
                    // Em destaque, no amarelo da marca BPM.
                    className="bg-bpm-primary hover:bg-bpm-primary-hover active:bg-bpm-primary-hover data-active:bg-bpm-primary h-9 text-base font-bold text-black hover:text-black active:text-black data-active:font-bold data-active:text-black"
                  >
                    <CalendarClock />
                    <span>
                      {rotuloDoMes(anoMes)} <span className="font-medium text-black/70">· {emTrabalho!.nomeMes}</span>
                    </span>
                    {emTrabalho!.dadosNovos ? <SinalDadosNovos /> : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {grupos.map((g) => (
          <SidebarGroup key={g.titulo}>
            <SidebarGroupLabel>{g.titulo}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.itens.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={itemAtivo(pathname, item)} tooltip={item.title} render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.title}</span>
                      {item.href === "/competencias" && algumComDadosNovos ? <SinalDadosNovos titulo="Há meses com dados importados de outro mês: reapure" /> : null}
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
