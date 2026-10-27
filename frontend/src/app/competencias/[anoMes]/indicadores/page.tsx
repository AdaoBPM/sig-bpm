import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { IndicadoresDoMes } from "./IndicadoresDoMes";

export default function IndicadoresDoMesPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="totais.indicadores:ler" fallback={<SemLeitura />}>
        <IndicadoresDoMes />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
