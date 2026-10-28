import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ContestacoesContent } from "../components/ContestacoesContent";

/** Contestações de Gastos (27/10/2026): a tela Validações. */
export default function ContestacoesValidacoesPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="contestacoes_validacoes:ler" fallback={<SemLeitura />}>
        <ContestacoesContent aba="validacoes" />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
