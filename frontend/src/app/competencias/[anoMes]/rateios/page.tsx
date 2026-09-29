import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { RateiosContent } from "./RateiosContent";

export default function RateiosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="apuracao:ler">
        <RateiosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
