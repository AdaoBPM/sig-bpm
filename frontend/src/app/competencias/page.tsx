import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { CompetenciasContent } from "./CompetenciasContent";

export default function CompetenciasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="competencia:ler">
        <CompetenciasContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
