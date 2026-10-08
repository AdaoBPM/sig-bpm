import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PainelContent } from "./PainelContent";

export default function PainelPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="dre:ler" fallback={<SemLeitura />}>
        <PainelContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
