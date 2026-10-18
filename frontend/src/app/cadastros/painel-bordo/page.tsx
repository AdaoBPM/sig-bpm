import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

/** O cadastro do Painel de Bordo (17/10/2026; Cadastros da Controladoria / Analítico): os itens das abas Resultados e Performance. */
export default function PainelBordoPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_analitico.painel_bordo:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="painel-bordo"
          rota="/cadastros/painel-bordo"
          titulo="Painel de Bordo"
          apenasAtivas
          comoUsar={
            <ul>
              <li>Cada linha é um item (um card) do Painel de Bordo. Use os filtros nos rótulos das colunas (o grupo e o quadro, por exemplo).</li>
              <li>
                O Grupo é a aba do Painel (Resultados ou Performance) e o Quadro, a seção dentro dela (Consolidado, Produção: Matriz…): os itens com o
                mesmo quadro ficam juntos. A Ordem põe os itens em sequência; os quadros seguem a ordem do primeiro item de cada um.
              </li>
              <li>
                O Nome e a Abreviação aparecem no card; o Comportamento diz o lado bom (↑ quanto maior, melhor; ↓ quanto menor, melhor) e define o sinal
                do desvio. O Modelo de Apuração é a conta que dá o valor (o realizado e o orçado), com o formato e o percentual sobre a receita; o nome
                dele diz o item e o quadro de origem, como “Receita Operacional Líquida (ROL - Consolidado)”.
              </li>
              <li>Use “Novo” para incluir um item; o lápis edita, e a exclusão fica dentro da edição. Inativo, o item sai do Painel de Bordo.</li>
              <li>
                Mudar o cadastro com uma competência apurada e ainda não fechada pede reapurar: até lá, ela não fecha (a DRE mostra o aviso). Os cards dos
                Relatórios Executivos acham o item pelo quadro, pelo nome e pela abreviação: mudá-los tira o card do relatório.
              </li>
            </ul>
          }
          descricao="Os itens do Painel de Bordo, como nas abas Painel (Resultados) e Painel (Performance) do SIG BPM 2026 - INDICADORES DE RESULTADO. O Painel de Bordo de Resultados Empresariais, o dos cenários e os cards dos Relatórios Executivos usam os itens ativos daqui. Carregado com os itens que a ferramenta já mostrava."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
