import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { CenariosContent } from "../sinteticos/CenariosContent";

/** A lista dos Cenários Analíticos (13/10/2026; antes, só o aviso "Tela em desenvolvimento"): a mesma tela dos sintéticos. */
export default function CenariosAnaliticosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos_lista:ler" fallback={<SemLeitura />}>
        <CenariosContent tipo="ANALITICO" />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
