import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function LinhasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="linhas"
          rota="/cadastros/linhas"
          titulo="Linhas"
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas (por exemplo, a unidade).</li>
              <li>Use “Novo” para incluir uma linha, escolhendo a unidade; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>As linhas de produto ficam na Matriz ou na Filial, e as de obra em Serviços: uma linha não passa de produto para obra.</li>
              <li>O Código é o texto com que as planilhas das Listas citam a linha; ele sai do nome, em maiúsculas, e não muda depois de criado.</li>
              <li>Uma linha usada nas Listas, no estoque ou nos preços não se exclui: inative-a.</li>
            </ul>
          }
          descricao="As linhas de cada unidade: Estrutura e Metalúrgica na Matriz; Alveolares e Estacas na Filial; Montagem, Fundação, Capeamento, Metálica, Telhamento, Turn-Key, Vedação e Outros em Serviços. As Listas Operacionais gravam cada registro com a linha e a unidade; as linhas de faturamento das medições não aparecem aqui."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
