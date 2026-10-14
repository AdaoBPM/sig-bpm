import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { RateiosContent } from "./RateiosContent";

export default function RateiosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="rateios:ler" fallback={<SemLeitura />}>
        <RateiosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
