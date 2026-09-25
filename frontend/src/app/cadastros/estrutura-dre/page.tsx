import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { EstruturaDreContent } from "./EstruturaDreContent";

export default function EstruturaDrePage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <EstruturaDreContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
