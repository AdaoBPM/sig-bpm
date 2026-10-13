import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenarioPainelContent } from "./CenarioPainelContent";

export default function CenarioPainelPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:ler" fallback={<SemLeitura />}>
        <CenarioPainelContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
