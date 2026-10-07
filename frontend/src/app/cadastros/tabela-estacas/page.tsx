import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function TabelaEstacasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="tabela-estacas"
          rota="/cadastros/tabela-estacas"
          titulo="Tabela de Estacas"
          comoUsar={
            <ul>
              <li>Use a busca e os filtros nos rótulos das colunas.</li>
              <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>Para mudar um preço a partir de uma data, inclua um registro com a nova vigência.</li>
            </ul>
          }
          descricao="Os preços das estacas por seção e grupo, com vigência (aba Tabela de Estacas do UNIDADES E CENTROS DE CUSTO), que valoram a variação do estoque de estacas."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
