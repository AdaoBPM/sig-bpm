import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { DivergenciasContent } from "./DivergenciasContent";

export default function DivergenciasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="divergencia:ler" fallback={<SemLeitura />}>
        <DivergenciasContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
