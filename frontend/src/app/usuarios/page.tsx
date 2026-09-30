import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { UsuariosContent } from "./UsuariosContent";

export default function UsuariosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="usuarios:ler">
        <UsuariosContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
