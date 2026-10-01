import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { DivergenciasContent } from "./DivergenciasContent";

export default function DivergenciasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="divergencia:ler">
        <DivergenciasContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
