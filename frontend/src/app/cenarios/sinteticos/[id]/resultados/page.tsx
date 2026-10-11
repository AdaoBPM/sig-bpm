import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioResultadosContent } from "./CenarioResultadosContent";

export default function CenarioResultadosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:ler" fallback={<SemLeitura />}>
        <CenarioResultadosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
