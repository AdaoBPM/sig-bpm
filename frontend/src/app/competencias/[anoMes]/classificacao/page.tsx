import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ClassificacaoContent } from "./ClassificacaoContent";

export default function ClassificacaoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="classificacao:ler" fallback={<SemLeitura />}>
        <ClassificacaoContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
