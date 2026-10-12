import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function TiposMovimentoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros_apuracao:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="tipos-movimento"
          rota="/cadastros/tipos-movimento"
          titulo="Tipos de Movimento"
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas.</li>
              <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>Uma devolução só vira receita quando o tipo de movimento dela está aqui.</li>
            </ul>
          }
          descricao="Os tipos de movimento de venda (aba Tipos de Movimento do UNIDADES E CENTROS DE CUSTO): uma devolução só vira receita quando o movimento está aqui."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
