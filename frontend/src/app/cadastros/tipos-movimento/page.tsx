import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function TiposMovimentoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler">
        <ListaCadastroContent
          entidade="tipos-movimento"
          rota="/cadastros/tipos-movimento"
          titulo="Tipos de movimento"
          descricao="Os tipos de movimento de venda (aba Tipos de Movimento do UNIDADES E CENTROS DE CUSTO): uma devolução só vira receita quando o movimento está aqui."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
