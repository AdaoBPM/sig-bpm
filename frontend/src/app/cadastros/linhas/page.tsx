import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";
import { BotaoCorrespondencia } from "./CorrespondenciaDialog";

export default function LinhasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros_controladoria:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="linhas"
          rota="/cadastros/linhas"
          titulo="Linhas"
          apenasAtivas
          acoesExtras={<BotaoCorrespondencia />}
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas (por exemplo, a unidade).</li>
              <li>Use “Novo” para incluir uma linha, escolhendo a unidade; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>As linhas de produto ficam na Matriz ou na Filial, e as de obra em Serviços: uma linha não passa de produto para obra.</li>
              <li>A Und. de Medida diz em que se mede a linha (m³, m³ e pistas, kg, m, m², dia ou %); será usada nos Cenários Analíticos. Escolha na lista, no lápis.</li>
              <li>As outras telas e as importações acham a linha pelo nome (sem diferença de maiúsculas): o nome é o texto com que as planilhas das Listas citam a linha.</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para esconder os registros inativos.</li>
              <li>Com movimentos (lançamentos, valores apurados, registros das listas), o Nome e a Unidade e a exclusão ficam bloqueados: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
              <li>
                “Correspondência Tarefa × Linha” abre a lista das tarefas das requisições e das notas fiscais e a linha dos custos de cada uma, numa filial
                ou em Qualquer Filial: inclua, troque a linha ou exclua e clique em “Gravar”. Vale na próxima carga do resultado realizado de um cenário
                analítico.
              </li>
            </ul>
          }
          descricao="As linhas de cada unidade: Estrutura e Metalúrgica na Matriz; Alveolares e Estacas na Filial; Montagem, Fundação, Capeamento, Metálica, Telhamento, Turn-Key, Vedação e Outros em Serviços. As Listas Operacionais gravam cada registro com a linha e a unidade, e as outras telas e as importações acham a linha pelo nome; as linhas de faturamento das medições não aparecem aqui. A Metalúrgica presta serviço às outras linhas: nos Cenários Analíticos, não tem demanda, receita nem custo próprios. A Correspondência Tarefa × Linha liga as tarefas das requisições e das notas fiscais às linhas: a referência realizada dos Cenários Analíticos divide os custos de cada conta entre as linhas na proporção dos documentos com a tarefa de cada uma (a correspondência da filial do documento vale antes da de Qualquer Filial), e o que não tem tarefa, ou tem uma tarefa fora da lista, vai pelo volume das linhas."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
