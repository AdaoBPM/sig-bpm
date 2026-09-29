import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { EstoqueContent } from "./EstoqueContent";

export default function RateiosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="apuracao:ler">
        <EstoqueContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
