import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ClassificacaoContent } from "./ClassificacaoContent";

export default function ClassificacaoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="classificacao:ler">
        <ClassificacaoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
