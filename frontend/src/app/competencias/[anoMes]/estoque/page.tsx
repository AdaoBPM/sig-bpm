import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { EstoqueContent } from "./EstoqueContent";

export default function RateiosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="apuracao:ler" fallback={<SemLeitura />}>
        <EstoqueContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
