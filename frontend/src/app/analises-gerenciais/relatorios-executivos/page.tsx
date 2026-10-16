import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { RelatoriosExecutivosContent } from "./RelatoriosExecutivosContent";

/** Os Relatórios Executivos (15/10/2026, Análises Gerenciais). */
export default function RelatoriosExecutivosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="relatorios_executivos:ler" fallback={<SemLeitura />}>
        <RelatoriosExecutivosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
