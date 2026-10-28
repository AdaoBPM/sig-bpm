import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ContestacoesContent } from "../components/ContestacoesContent";

/** Contestações de Gastos (27/10/2026): a aba Solicitadas da tela Contestações. */
export default function ContestacoesSolicitadasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="contestacoes.solicitadas:ler" fallback={<SemLeitura />}>
        <ContestacoesContent aba="solicitadas" />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
