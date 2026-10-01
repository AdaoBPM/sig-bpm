import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaContent } from "./ListaContent";

export default function ListaPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="listas_operacionais:ler" fallback={<SemLeitura />}>
        <ListaContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
