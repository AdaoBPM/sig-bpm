import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ImportarContent } from "./ImportarContent";

export default function ImportarPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="importacao:ler" fallback={<SemLeitura />}>
        <ImportarContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
