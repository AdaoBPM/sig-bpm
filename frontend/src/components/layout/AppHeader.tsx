"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { podeSair } from "@/lib/alteracoesPendentes";
import { useTema, type Tema } from "@/lib/tema";
import { KeyRound, LogOut } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { etapasDoMes } from "@/lib/etapasDoMes";
import { migalhas } from "@/lib/navigation-config";

import { TrocarSenhaDialog } from "./TrocarSenhaDialog";

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Os temas no menu do usuário: Padrão (o círculo dividido, preto | branco), Claro (branco) e Escuro (preto). */
const TEMAS: Array<{ tema: Tema; rotulo: string; fundo: string }> = [
  { tema: "padrao", rotulo: "Padrão", fundo: "bg-[linear-gradient(90deg,#111111_50%,#ffffff_50%)]" },
  { tema: "claro", rotulo: "Claro (menu lateral branco)", fundo: "bg-[#ffffff]" },
  { tema: "escuro", rotulo: "Escuro (telas em cinza escuro)", fundo: "bg-[#111111]" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [tema, escolherTema] = useTema();
  const { hasPermission } = usePermissions();
  const etapas = etapasDoMes(hasPermission, user?.acesso);
  const caminho = migalhas(pathname, (chave) => etapas.find((e) => e.chave === chave)?.rotulo ?? null);

  async function handleLogout() {
    if (!podeSair()) return;
    await logout();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          {caminho.map((m, i) => (
            <Fragment key={`${i}-${m.rotulo}`}>
              {i > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {i === caminho.length - 1 ? (
                  <BreadcrumbPage>{m.rotulo}</BreadcrumbPage>
                ) : m.href ? (
                  <BreadcrumbLink render={<Link href={m.href} />}>{m.rotulo}</BreadcrumbLink>
                ) : (
                  <span className="text-muted-foreground">{m.rotulo}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-9 gap-2 px-2"
                aria-label="Menu do usuário"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-bpm-primary text-xs font-semibold text-black">
                {getInitials(user?.nome ?? "U")}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[140px] truncate text-sm font-medium md:inline">
              {user?.nome ?? "Usuário"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user?.nome}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                  {user?.perfil ? <span className="text-xs text-muted-foreground">Perfil: {user.perfil.nome}</span> : null}
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* O tema (13/10/2026): três círculos — Padrão (preto | branco), Claro (branco) e Escuro (preto). */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
              <span>Tema</span>
              <span className="flex items-center gap-2" role="radiogroup" aria-label="Tema">
                {TEMAS.map((t) => (
                  <button
                    key={t.tema}
                    type="button"
                    role="radio"
                    aria-checked={tema === t.tema}
                    aria-label={t.rotulo}
                    title={t.rotulo}
                    onClick={() => escolherTema(t.tema)}
                    className={`size-5 rounded-full border border-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${t.fundo} ${tema === t.tema ? "ring-2 ring-bpm-primary ring-offset-1 ring-offset-[var(--popover)]" : "hover:ring-1 hover:ring-gray-400"}`}
                  />
                ))}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTrocandoSenha(true)}>
              <KeyRound />
              Trocar senha
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void handleLogout()}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {trocandoSenha ? <TrocarSenhaDialog onFechar={() => setTrocandoSenha(false)} /> : null}
    </header>
  );
}
