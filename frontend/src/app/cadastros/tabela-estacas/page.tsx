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
          descricao="Os preços das estacas por seção e grupo, com vigência (aba Tabela de Estacas do UNIDADES E CENTROS DE CUSTO), que valoram a variação do estoque de estacas."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
