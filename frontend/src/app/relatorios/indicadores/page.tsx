import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { IndicadoresContent } from "./IndicadoresContent";

export default function IndicadoresPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="resultados:ler" fallback={<SemLeitura />}>
        <IndicadoresContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
