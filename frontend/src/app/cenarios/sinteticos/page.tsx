import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenariosContent } from "./CenariosContent";

export default function CenariosSinteticosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_lista:ler" fallback={<SemLeitura />}>
        <CenariosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
