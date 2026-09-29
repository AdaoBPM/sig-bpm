import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ReceitaPreviaContent } from "./ReceitaPreviaContent";

export default function ReceitaPreviaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="apuracao:ler">
        <ReceitaPreviaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
