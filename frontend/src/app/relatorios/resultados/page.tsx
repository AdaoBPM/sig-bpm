import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ResultadosContent } from "./ResultadosContent";

export default function ResultadosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="relatorio_resultados:ler" fallback={<SemLeitura />}>
        <ResultadosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
