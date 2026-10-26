import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ImportacaoContent } from "./ImportacaoContent";

/** A Importação dos Resultados por Linha (26/10/2026): as requisições e as notas fiscais de cada mês. */
export default function ImportacaoDosResultadosPorLinhaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="resultados_linha_importacao:ler" fallback={<SemLeitura />}>
        <ImportacaoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
