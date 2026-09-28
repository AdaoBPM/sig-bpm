import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { PrecosContratoContent } from "./PrecosContratoContent";

export default function PrecosContratoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <PrecosContratoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
