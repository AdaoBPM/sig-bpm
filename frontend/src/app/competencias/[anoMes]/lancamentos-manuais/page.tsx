import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { LancamentosManuaisContent } from "./LancamentosManuaisContent";

export default function LancamentosManuaisPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="lancamentos_manuais.controladoria:ler" fallback={<SemLeitura />}>
        <LancamentosManuaisContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
