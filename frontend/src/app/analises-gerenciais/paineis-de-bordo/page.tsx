import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PaineisDeBordoContent } from "./PaineisDeBordoContent";

/** Painéis e Apresentações (31/10/2026, Análises Gerenciais): painéis feitos a partir dos Relatórios Executivos. */
export default function PaineisDeBordoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="paineis_de_bordo:ler" fallback={<SemLeitura />}>
        <PaineisDeBordoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
