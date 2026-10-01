import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { EstruturaDreContent } from "./EstruturaDreContent";

export default function EstruturaDrePage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler" fallback={<SemLeitura />}>
        <EstruturaDreContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
