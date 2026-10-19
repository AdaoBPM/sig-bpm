import { Suspense } from "react";

import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioPainelContent } from "./CenarioPainelContent";

export default function CenarioPainelPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_painel:ler" fallback={<SemLeitura />}>
        {/* A aba pedida no endereço (?aba=indicadores) se lê com useSearchParams, dentro do Suspense. */}
        <Suspense fallback={<div className="h-64 animate-pulse rounded-sm bg-gray-100" />}>
          <CenarioPainelContent />
        </Suspense>
      </PermissionGuard>
    </ProtectedLayout>
  );
}
