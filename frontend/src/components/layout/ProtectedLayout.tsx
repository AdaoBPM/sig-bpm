"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldOff } from "lucide-react";

import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { permissaoDaTela } from "@/lib/navigation-config";

type ProtectedLayoutProps = {
  children: ReactNode;
};

/** A tela aberta pela URL sem a permissão dela: aviso, sem carregar nada (o backend também recusa os dados). */
function SemAcesso() {
  return (
    <div className="mx-auto mt-10 max-w-lg space-y-3 rounded-sm border border-gray-200 bg-white p-6 text-center">
      <ShieldOff className="mx-auto size-8 text-gray-400" />
      <h1 className="text-lg font-bold text-gray-900">Sem acesso a esta tela</h1>
      <p className="text-sm text-gray-600">O seu perfil de usuário não inclui esta tela. Se precisar dela, fale com o setor Contábil.</p>
      <Link href="/competencias" className="inline-block text-sm font-medium text-gray-900 underline underline-offset-2">
        Voltar às competências
      </Link>
    </div>
  );
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const pathname = usePathname();
  const { isLoading } = useAuth();
  const { hasPermission } = usePermissions();
  const exigida = permissaoDaTela(pathname);
  const bloqueada = !isLoading && exigida !== null && !hasPermission(exigida);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-muted/30">
        <AppHeader />
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          {isLoading && exigida ? <div className="h-40 animate-pulse rounded-sm bg-gray-100" /> : bloqueada ? <SemAcesso /> : children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
