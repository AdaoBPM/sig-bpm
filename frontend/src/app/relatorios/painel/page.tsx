import { Suspense } from "react";

import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PainelContent } from "./PainelContent";

export default function PainelPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="relatorio_painel:ler" fallback={<SemLeitura />}>
        {/* A aba pedida no endereço (?aba=indicadores) se lê com useSearchParams, dentro do Suspense. */}
        <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-gray-100" />}>
          <PainelContent />
        </Suspense>
      </PermissionGuard>
    </ProtectedLayout>
  );
}
