import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { CentrosCustoContent } from "./CentrosCustoContent";

export default function CentrosCustoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <CentrosCustoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
