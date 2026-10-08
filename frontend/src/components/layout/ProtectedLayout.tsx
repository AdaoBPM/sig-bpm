"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ShieldOff } from "lucide-react";

import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BarraDeTelas } from "@/components/layout/BarraDeTelas";
import { EtapasDoMes } from "@/components/layout/EtapasDoMes";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { lerRotaDoMes } from "@/lib/etapasDoMes";
import { grupoDaTela, permissaoDaTela } from "@/lib/navigation-config";

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
  const { isLoading, user } = useAuth();
  const { hasPermission } = usePermissions();
  const exigida = permissaoDaTela(pathname);
  const bloqueada = !isLoading && exigida !== null && !hasPermission(exigida);
  // Nas telas de um mês, a barra de etapas fica no topo do conteúdo.
  const doMes = lerRotaDoMes(pathname);
  // Nas telas de um grupo (cadastros, usuários), a barra do grupo.
  const doGrupo = grupoDaTela(pathname);

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* Fundo opaco (a mesma cor de antes), para o título fixo da tela cobrir o que passa por baixo. */}
      <SidebarInset className="min-w-0 bg-[color-mix(in_srgb,var(--muted)_30%,var(--background))]">
        <AppHeader />
        {user?.divergenciasAbertas && (pathname === "/competencias" || pathname.startsWith("/competencias/")) ? (
          // O aviso de divergência aberta (Passo 24), só nas telas de competência e do mês
          // (decisão D3 do levantamento de layout); leva ao mês com divergências abertas.
          <Link
            href="/divergencias"
            title="Dado recebido depois do fechamento ou da apuração que difere do gravado"
            className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 hover:bg-yellow-100 md:px-6"
          >
            <AlertTriangle className="size-4 shrink-0" />
            {user.divergenciasAbertas === 1 ? "1 divergência aberta" : `${user.divergenciasAbertas} divergências abertas`} · Ver divergências
          </Link>
        ) : null}
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          {doMes && user ? <EtapasDoMes anoMes={doMes.anoMes} chave={doMes.chave} resto={doMes.resto} /> : null}
          {doGrupo && user ? <BarraDeTelas grupo={doGrupo.grupo} atual={doGrupo.tela.href} /> : null}
          {isLoading && exigida ? <div className="h-40 animate-pulse rounded-sm bg-gray-100" /> : bloqueada ? <SemAcesso /> : children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
