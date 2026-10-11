import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioIndicadoresContent } from "./CenarioIndicadoresContent";

export default function CenarioIndicadoresPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:ler" fallback={<SemLeitura />}>
        <CenarioIndicadoresContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
