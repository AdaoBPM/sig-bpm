import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function EstruturaIndicadoresPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_analitico.estrutura_indicadores:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="estrutura-indicadores"
          rota="/cadastros/estrutura-indicadores"
          titulo="Indicadores"
          apenasAtivas
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas (o grupo, por exemplo).</li>
              <li>Use “Novo” para incluir um indicador; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>
                Na Metodologia, monte a fórmula do indicador: escolha o tipo do item (uma linha da DRE, com a unidade; um totalizador das Listas;
                um indicador do Comercial ou do Administrativo; uma meta do Orçamento, o cenário marcado), busque, escolha e clique em “Inserir Item”; entre os
                itens, use os operadores (+ − × ÷), os parênteses e o número digitado com “Inserir” (por exemplo, ÷ 1000 para milhares). “Apagar” desfaz
                o último pedaço, e “Limpar” apaga a fórmula inteira.
              </li>
              <li>
                Unidade de Medida: R$ em Milhões (M) e R$ em Milhares (K) mostram o valor em reais em milhões ou em milhares, com uma
                casa, como nos cards do Painel de Bordo (a fórmula continua em reais, sem dividir por 1000).
              </li>
              <li>
                Acumulado: Soma dos Meses (a fórmula sobre a soma de cada item; nas razões, a soma dos numeradores sobre a dos denominadores),
                Média Ponderada (pelo Peso da Média, montado como a Metodologia) ou Último Mês (os de posição, como o quadro de lotação). Os de
                Cálculo do Sistema têm a conta no código.
              </li>
              <li>A Descrição é o texto que a tela Indicadores de Resultados Empresariais mostra sob o nome.</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para esconder os indicadores inativos (que saem das telas Indicadores e Painel de Bordo de Resultados Empresariais).</li>
              <li>O Nome de um indicador com metas em cenários, valores importados ou digitados, ou usado no Painel de Bordo, não muda, e o indicador não se exclui: inative-o.</li>
              <li>Mudar este cadastro com uma competência apurada e ainda não fechada pede reapurar (vale para todos os Cadastros da Controladoria): até lá, ela não fecha, e a DRE mostra o aviso. Ao gravar, a mensagem diz quais competências reapurar.</li>
            </ul>
          }
          descricao="Os indicadores de resultado, com a fórmula que os calcula nas telas Indicadores, Painel de Bordo e Exportar de Resultados Empresariais: linhas da DRE apurada por unidade, totalizadores das Listas, indicadores do Comercial e do Administrativo e metas do Orçamento (o cenário marcado). Carregados com as contas que a ferramenta já fazia, conferidas mês a mês."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
