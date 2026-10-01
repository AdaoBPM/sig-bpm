import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { UsuariosContent } from "./UsuariosContent";

export default function UsuariosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="usuarios:ler" fallback={<SemLeitura />}>
        <UsuariosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
