import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ContestacoesContent } from "../components/ContestacoesContent";

/** Contestações de Gastos (27/10/2026): a aba Recebidas da tela Contestações. */
export default function ContestacoesRecebidasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="contestacoes.recebidas:ler" fallback={<SemLeitura />}>
        <ContestacoesContent aba="recebidas" />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
