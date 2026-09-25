import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ReclassificacoesContent } from "./ReclassificacoesContent";

export default function ReclassificacoesPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <ReclassificacoesContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
