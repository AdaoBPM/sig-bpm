import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { EditarCenarioContent } from "./EditarCenarioContent";

export default function EditarCenarioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:editar" fallback={<SemLeitura />}>
        <EditarCenarioContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
