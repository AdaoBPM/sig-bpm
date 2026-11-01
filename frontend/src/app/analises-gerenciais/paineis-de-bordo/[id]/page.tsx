import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PainelDeBordoContent } from "./PainelDeBordoContent";

/** Um Painel de Bordo (31/10/2026). */
export default function PainelDeBordoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="paineis_de_bordo:ler" fallback={<SemLeitura />}>
        <PainelDeBordoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
