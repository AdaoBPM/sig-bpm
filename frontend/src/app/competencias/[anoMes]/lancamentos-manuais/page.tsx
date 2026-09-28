import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { LancamentosManuaisContent } from "./LancamentosManuaisContent";

export default function LancamentosManuaisPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="lancamentos_manuais:ler">
        <LancamentosManuaisContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
