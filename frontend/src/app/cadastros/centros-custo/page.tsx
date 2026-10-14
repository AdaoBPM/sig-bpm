import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CentrosCustoContent } from "./CentrosCustoContent";

export default function CentrosCustoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_centros_custo:ler" fallback={<SemLeitura />}>
        <CentrosCustoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
