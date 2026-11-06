import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ArquivosGeraisContent } from "../components/ArquivosGeraisContent";

/** Arquivos Gerais (05/11/2026): a tela Treinamentos. */
export default function ArquivosTreinamentosPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="arquivos_treinamentos:ler" fallback={<SemLeitura />}>
        <ArquivosGeraisContent tela="treinamentos" />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
