import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { JustificativasContent } from "./JustificativasContent";

export default function JustificativasDoCenarioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios:ler" fallback={<SemLeitura />}>
        <JustificativasContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
