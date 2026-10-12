import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function LinhasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros_controladoria:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="linhas"
          rota="/cadastros/linhas"
          titulo="Linhas"
          apenasAtivas
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas (por exemplo, a unidade).</li>
              <li>Use “Novo” para incluir uma linha, escolhendo a unidade; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>As linhas de produto ficam na Matriz ou na Filial, e as de obra em Serviços: uma linha não passa de produto para obra.</li>
              <li>As outras telas e as importações acham a linha pelo nome (sem diferença de maiúsculas): o nome é o texto com que as planilhas das Listas citam a linha.</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para esconder os registros inativos.</li>
              <li>Com movimentos (lançamentos, valores apurados, registros das listas), o Nome e a Unidade e a exclusão ficam bloqueados: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
            </ul>
          }
          descricao="As linhas de cada unidade: Estrutura e Metalúrgica na Matriz; Alveolares e Estacas na Filial; Montagem, Fundação, Capeamento, Metálica, Telhamento, Turn-Key, Vedação e Outros em Serviços. As Listas Operacionais gravam cada registro com a linha e a unidade, e as outras telas e as importações acham a linha pelo nome; as linhas de faturamento das medições não aparecem aqui."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
