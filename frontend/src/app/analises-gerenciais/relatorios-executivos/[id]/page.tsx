import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { RelatorioExecutivoContent } from "./RelatorioExecutivoContent";

/** Um Relatório Executivo (15/10/2026). */
export default function RelatorioExecutivoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="relatorios_executivos:ler" fallback={<SemLeitura />}>
        <RelatorioExecutivoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
