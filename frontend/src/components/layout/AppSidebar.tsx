"use client";

import { Fragment, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BpmLogo } from "@/components/layout/BpmLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

/**
 * "Apenas Telas Prontas" (14/10/2026): esconde do menu os processos em desenvolvimento. A escolha fica guardada neste
 * navegador (vale nas próximas sessões); sem armazenamento (janela privada), vale só nesta visita. Lida por
 * useSyncExternalStore, como as outras escolhas guardadas: no servidor, desmarcada.
 */
const CHAVE_PRONTAS = "sig.menu.apenasTelasProntas";
const ouvintesDasProntas = new Set<() => void>();
let prontasNaMemoria: boolean | null = null;
function lerApenasProntas() {
  if (prontasNaMemoria !== null) return prontasNaMemoria;
  try {
    return window.localStorage.getItem(CHAVE_PRONTAS) === "1";
  } catch {
    return false; // sem armazenamento
  }
}
function useApenasTelasProntas(): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore(
    (avisar) => {
      ouvintesDasProntas.add(avisar);
      return () => ouvintesDasProntas.delete(avisar);
    },
    lerApenasProntas,
    () => false,
  );
  const mudar = (v: boolean) => {
    prontasNaMemoria = v;
    try {
      window.localStorage.setItem(CHAVE_PRONTAS, v ? "1" : "0");
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    ouvintesDasProntas.forEach((avisar) => avisar());
  };
  return [valor, mudar];
}

export function AppSidebar() {
  const [apenasProntas, setApenasProntas] = useApenasTelasProntas();
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
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !apenasProntas || !i.emDesenvolvimento).map((i) => itemPermitido(i, hasPermission)).filter((i) => i !== null) }))
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
          <Fragment key={g.titulo}>
          <SidebarGroup>
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
                      className={
                        item.emDesenvolvimento
                          ? // Os processos em desenvolvimento (14/10/2026): o texto em cinza e o destaque amarelo-claro.
                            "text-sidebar-foreground/50 hover:text-sidebar-foreground/70 data-active:bg-yellow-100 data-active:font-bold data-active:text-gray-600 data-active:hover:bg-yellow-100 data-active:hover:text-gray-600"
                          : "data-active:bg-bpm-primary data-active:font-bold data-active:text-black data-active:hover:bg-bpm-primary data-active:hover:text-black"
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                      {item.href === "/competencias" && algumComDadosNovos ? <SinalDadosNovos titulo="Há meses com entradas alteradas depois da apuração: reapure" /> : null}
                    </SidebarMenuButton>
                    {item.badge ? <SidebarMenuBadge className="bg-[color:var(--cor-contador-menu)] text-[color:var(--cor-texto-contador-menu)] peer-data-active/menu-button:text-[color:var(--cor-texto-contador-menu)] peer-hover/menu-button:text-[color:var(--cor-texto-contador-menu)]">{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* O separador amarelo-ouro abaixo de cada grupo (14/10/2026): na largura do texto dos processos (o recuo do grupo e
              do processo, 1 rem de cada lado); no menu recolhido (3 rem), o mesmo recuo deixa a largura do ícone. */}
          <div aria-hidden className="mx-4 h-px shrink-0 bg-bpm-primary group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:w-4" />
          </Fragment>
        ))}
      </SidebarContent>

      {/* Acima do indicador do Next.js (no desenvolvimento, no canto de baixo). */}
      <SidebarFooter className={`border-t border-sidebar-border group-data-[collapsible=icon]:hidden ${process.env.NODE_ENV === "development" ? "pb-16" : ""}`}>
        <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-sidebar-foreground/80">
          <input type="checkbox" checked={apenasProntas} onChange={(e) => setApenasProntas(e.target.checked)} className="size-3.5 accent-[var(--sidebar-primary)]" />
          Apenas Telas Prontas
        </label>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
