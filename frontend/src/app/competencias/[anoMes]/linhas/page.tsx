import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { LinhasContent } from "./LinhasContent";

/** A etapa Linhas do mês (26/10/2026): a conferência das linhas gravadas na apuração. */
export default function LinhasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="linhas_mes:ler" fallback={<SemLeitura />}>
        <LinhasContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
