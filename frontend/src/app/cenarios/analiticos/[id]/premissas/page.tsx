import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { PremissasContent } from "./PremissasContent";

/** A tela Premissas de um cenário analítico (13/10/2026). */
export default function PremissasAnaliticoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cenarios_analiticos_premissas:ler" fallback={<SemLeitura />}>
        <PremissasContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
