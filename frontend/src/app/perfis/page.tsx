import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { PerfisContent } from "./PerfisContent";

export default function PerfisPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="usuarios:ler">
        <PerfisContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
