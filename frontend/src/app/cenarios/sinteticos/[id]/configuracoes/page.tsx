import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ConfiguracoesContent } from "./ConfiguracoesContent";

export default function ConfiguracoesCenarioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:editar" fallback={<SemLeitura />}>
        <ConfiguracoesContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
