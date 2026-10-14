import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioResultadosContent } from "@/app/cenarios/sinteticos/[id]/resultados/CenarioResultadosContent";

/** A tela Resultados de um cenário analítico (13/10/2026): a mesma tela dos sintéticos, com a permissão dos Cenários Analíticos. */
export default function CenarioResultadosAnaliticoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos_resultados:ler" fallback={<SemLeitura />}>
        <CenarioResultadosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
