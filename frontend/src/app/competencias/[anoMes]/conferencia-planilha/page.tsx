import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ConferenciaPlanilhaContent } from "./ConferenciaPlanilhaContent";

export default function ConferenciaPlanilhaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="conferencia:ler" fallback={<SemLeitura />}>
        <ConferenciaPlanilhaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
