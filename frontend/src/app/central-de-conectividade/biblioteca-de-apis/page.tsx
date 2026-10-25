import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { BibliotecaDeApisContent } from "./BibliotecaDeApisContent";

/** A Biblioteca de APIs (24/10/2026, Central de Conectividade). */
export default function BibliotecaDeApisPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="biblioteca_apis:ler" fallback={<SemLeitura />}>
        <BibliotecaDeApisContent />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
