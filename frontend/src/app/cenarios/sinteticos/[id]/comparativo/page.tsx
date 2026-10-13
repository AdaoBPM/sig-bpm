import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ComparativoContent } from "./ComparativoContent";

export default function ComparativoDoCenarioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:ler" fallback={<SemLeitura />}>
        <ComparativoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
