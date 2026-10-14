import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PrecosContratoContent } from "./PrecosContratoContent";

export default function PrecosContratoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_precos_contrato:ler" fallback={<SemLeitura />}>
        <PrecosContratoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
