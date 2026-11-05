import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ResultadosDaObraContent } from "./ResultadosDaObraContent";

/** O Realizado por Obra (03/11/2026), Resultados: a DRE da obra mês a mês, contra o vendido. */
export default function ResultadosDaObraPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="realizado_obra_resultados:ler" fallback={<SemLeitura />}>
        <ResultadosDaObraContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
