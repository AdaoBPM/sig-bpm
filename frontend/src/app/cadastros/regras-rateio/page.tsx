import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function RegrasRateioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <ListaCadastroContent
          entidade="regras-rateio"
          rota="/cadastros/regras-rateio"
          titulo="Regras de rateio"
          descricao="As chaves de rateio por volume (aba Rateios do BASE REALIZADO (OPERAÇÃO)). A chave e o destino são fixos depois de criada a regra."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
