import { Suspense } from "react";

import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ConfiguracoesContent } from "./ConfiguracoesContent";

export default function ConfiguracoesCenarioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_configuracoes:ler" fallback={<SemLeitura />}>
        {/* A aba pedida na URL (?aba=comparativo) é lida no cliente. */}
        <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-gray-100" />}>
          <ConfiguracoesContent />
        </Suspense>
      </PermissionGuard>
    </ProtectedLayout>
  );
}
