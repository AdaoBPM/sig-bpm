import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ReajustesContent } from "@/app/cenarios/sinteticos/[id]/reajustes/ReajustesContent";

/** A tela Reajustes de um cenário analítico (13/10/2026): a mesma tela dos sintéticos, com a permissão dos Cenários Analíticos. */
export default function ReajustesAnaliticoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos:ler" fallback={<SemLeitura />}>
        <ReajustesContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
