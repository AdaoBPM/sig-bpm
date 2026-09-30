import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { AuditoriaContent } from "./AuditoriaContent";

export default function AuditoriaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="auditoria:ler">
        <AuditoriaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
