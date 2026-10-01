import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { AuditoriaContent } from "./AuditoriaContent";

export default function AuditoriaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="auditoria:ler" fallback={<SemLeitura />}>
        <AuditoriaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
