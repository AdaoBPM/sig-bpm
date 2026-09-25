import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ContasResultadoContent } from "./ContasResultadoContent";

export default function ContasResultadoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <ContasResultadoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
