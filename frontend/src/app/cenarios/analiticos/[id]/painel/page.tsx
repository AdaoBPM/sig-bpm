import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioPainelContent } from "@/app/cenarios/sinteticos/[id]/painel/CenarioPainelContent";

/** O Painel de Bordo de um cenário analítico (13/10/2026): a mesma tela dos sintéticos, com a permissão dos Cenários Analíticos. */
export default function CenarioPainelAnaliticoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos:ler" fallback={<SemLeitura />}>
        <CenarioPainelContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
