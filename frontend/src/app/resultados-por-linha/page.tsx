import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ResultadosPorLinhaContent } from "./ResultadosPorLinhaContent";

/** Os Resultados por Linha (26/10/2026; antes, em desenvolvimento): a DRE de cada linha de produto e de obra. */
export default function ResultadosPorLinhaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="resultados_linha:ler" fallback={<SemLeitura />}>
        <ResultadosPorLinhaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
