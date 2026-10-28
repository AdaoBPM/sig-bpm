import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { LancamentosContestacoesContent } from "./LancamentosContestacoesContent";

/** A aba Contestações dos Lançamentos (27/10/2026). */
export default function LancamentosContestacoesPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="lancamentos_manuais.contestacoes:ler" fallback={<SemLeitura />}>
        <LancamentosContestacoesContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
