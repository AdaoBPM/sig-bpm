import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ReclassificacoesContent } from "./ReclassificacoesContent";

export default function ReclassificacoesPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler" fallback={<SemLeitura />}>
        <ReclassificacoesContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
