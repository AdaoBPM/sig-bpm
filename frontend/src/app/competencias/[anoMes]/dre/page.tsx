import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { DREContent } from "./DREContent";

export default function DREPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="dre:ler" fallback={<SemLeitura />}>
        <DREContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
