import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ResultadosDaLinhaContent } from "./ResultadosDaLinhaContent";

/** A tela Resultados dos Resultados por Linha (26/10/2026): as abas Resultados, Rateios por Obras e Conferência. */
export default function ResultadosDaLinhaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="resultados_linha:ler" fallback={<SemLeitura />}>
        <ResultadosDaLinhaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
