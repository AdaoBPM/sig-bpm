import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ContasResultadoContent } from "./ContasResultadoContent";

export default function ContasResultadoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros_controladoria:ler" fallback={<SemLeitura />}>
        <ContasResultadoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
