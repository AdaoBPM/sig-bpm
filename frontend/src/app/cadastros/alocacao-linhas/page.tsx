import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

/**
 * A Alocação nas Linhas (26/10/2026, pedido do Adão): as regras com que os Resultados por Linha levam às linhas os custos
 * sem tarefa — um centro de custo, ou o rateio dos centros sem regra própria, vai a uma linha (100%) ou a uma base por
 * linha. Mantidas pelos usuários da Controladoria, no lugar de regras no código.
 */
export default function AlocacaoLinhasPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_controladoria.alocacao_linhas:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="alocacao-linhas"
          rota="/cadastros/alocacao-linhas"
          titulo="Alocação nas Linhas"
          apenasAtivas
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas (por exemplo, a Origem ou o Rateio).</li>
              <li>
                Use “Novo” para incluir uma regra: a Origem — um Centro de Custo, ou um Rateio (os centros dele sem regra própria) —, o Destino — Uma
                Linha (100%) ou Base por Linha — e a vigência. O lápis edita, e a exclusão fica dentro da edição.
              </li>
              <li>
                Uma Linha leva 100% do que a DRE dá à unidade da linha: vários centros podem ir à mesma linha, sem precisar ter o nome dela (Estrutura e
                Consoles na Estrutura; Guindasteiros e Maquinário (Montagem) na Montagem). O que o rateio do centro leva a outras unidades segue a regra
                do rateio.
              </li>
              <li>
                Base por Linha divide o que a DRE dá a cada unidade entre as linhas dela, pelo volume de cada uma nas listas do mês: Volume Produzido (m³),
                Projetos Liberados (m³), Metalurgia Consumida (kg, pela linha que consome), Armadura (kg), Dias de Acompanhamento ou Receita Bruta (a
                Receita Prévia). A linha sem volume no mês não recebe.
              </li>
              <li>
                A ordem nos Resultados por Linha: a tarefa das requisições e das notas fiscais (Linhas › Tarefas), a regra do centro, a obra (os centros
                de obra, pela produção, pelos acompanhamentos ou pela receita da própria obra), a regra do rateio do centro e, por último, o volume da
                unidade. Cada passo recebe só o que sobrou do anterior: nada fica sem linha, e a soma das linhas fecha com a DRE da unidade.
              </li>
              <li>
                Vigências: cada regra vale do mês do início até o mês do fim. Uma origem tem uma regra por vez: para mudá-la a partir de um mês,
                preencha o Fim da atual e crie a nova com o Início no mês seguinte. Marque “Apenas Ativas”, ao lado dos botões, para ver só as vigentes.
              </li>
              <li>Este cadastro não entra na apuração da DRE: mudá-lo não pede reapurar, e os Resultados por Linha seguem as regras da vigência de cada mês.</li>
            </ul>
          }
          descricao="Como os custos sem tarefa chegam às linhas nos Resultados por Linha: cada centro de custo, ou o rateio dos centros sem regra própria, vai a uma linha (100%) ou é dividido entre as linhas da unidade pelo volume de cada uma nas listas do mês. Mantido aqui pelos usuários da Controladoria, no lugar de regras fixas no sistema."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
