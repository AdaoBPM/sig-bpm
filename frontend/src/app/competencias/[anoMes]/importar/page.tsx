import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ImportarContent } from "./ImportarContent";

export default function ImportarPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="importacao:ler">
        <ImportarContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
