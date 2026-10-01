import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ConferenciaPlanilhaContent } from "./ConferenciaPlanilhaContent";

export default function ConferenciaPlanilhaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="apuracao:ler">
        <ConferenciaPlanilhaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
