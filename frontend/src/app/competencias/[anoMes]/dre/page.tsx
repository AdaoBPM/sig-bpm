import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { DREContent } from "./DREContent";

export default function RateiosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="dre:ler">
        <DREContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
