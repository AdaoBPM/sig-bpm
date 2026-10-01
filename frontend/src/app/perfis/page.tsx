import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PerfisContent } from "./PerfisContent";

export default function PerfisPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="usuarios:ler" fallback={<SemLeitura />}>
        <PerfisContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
