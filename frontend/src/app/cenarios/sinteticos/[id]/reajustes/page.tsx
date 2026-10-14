import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ReajustesContent } from "./ReajustesContent";

export default function ReajustesDoCenarioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_reajustes:ler" fallback={<SemLeitura />}>
        <ReajustesContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
