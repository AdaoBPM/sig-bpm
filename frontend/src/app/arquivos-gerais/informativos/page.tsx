import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ArquivosGeraisContent } from "../components/ArquivosGeraisContent";

/** Arquivos Gerais (05/11/2026): a tela Informativos. */
export default function ArquivosInformativosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="arquivos_informativos:ler" fallback={<SemLeitura />}>
        <ArquivosGeraisContent tela="informativos" />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
