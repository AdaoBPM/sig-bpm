import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ReceitaPreviaContent } from "./ReceitaPreviaContent";

export default function ReceitaPreviaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="previas.receita:ler" fallback={<SemLeitura />}>
        <ReceitaPreviaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
