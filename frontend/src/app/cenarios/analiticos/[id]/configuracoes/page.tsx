import { Suspense } from "react";

import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ConfiguracoesContent } from "@/app/cenarios/sinteticos/[id]/configuracoes/ConfiguracoesContent";

/** A tela Configurações de um cenário analítico (13/10/2026): a mesma tela dos sintéticos, com a permissão dos Cenários Analíticos. */
export default function ConfiguracoesAnaliticoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos:editar" fallback={<SemLeitura />}>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-gray-100" />}>
          <ConfiguracoesContent />
        </Suspense>
      </PermissionGuard>
    </ProtectedLayout>
  );
}
