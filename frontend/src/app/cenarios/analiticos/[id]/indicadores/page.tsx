import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioIndicadoresContent } from "@/app/cenarios/sinteticos/[id]/indicadores/CenarioIndicadoresContent";

/** A tela Indicadores de um cenário analítico (13/10/2026): a mesma tela dos sintéticos, com a permissão dos Cenários Analíticos. */
export default function CenarioIndicadoresAnaliticoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos:ler" fallback={<SemLeitura />}>
        <CenarioIndicadoresContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
