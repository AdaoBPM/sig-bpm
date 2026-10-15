import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { RegrasRateioContent } from "./RegrasRateioContent";

export default function RegrasRateioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_regras_rateio:ler" fallback={<SemLeitura />}>
        <RegrasRateioContent
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas.</li>
              <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>A chave não muda depois de criada a regra: para trocá-la, exclua e crie outra.</li>
              <li>O Destino é um dos totais destacados nas Listas Operacionais, que dá o volume da regra; a lista mostra só os da Chave escolhida (Metalurgia: Matriz, Filial, Montagem e Complementar, na chave METALURGIA…).</li>
              <li>A unidade que recebe e a base física saem do Destino: Projetos Liberados: Matriz vai para a Matriz; Metalurgia: Complementar, para a Complementar (unidade Serviços); as pistas, para a Filial.</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para ver só as regras vigentes (sem vigência encerrada).</li>
              <li>Com movimentos (as apurações de rateio), o Destino e a exclusão ficam bloqueados: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
              <li>
                Vigências: cada regra vale do mês do início (se começa no dia 1º; senão, do mês seguinte) até o mês do fim. Para mudar uma chave a
                partir de um mês, preencha o Fim das regras atuais e crie as novas com o Início no mês seguinte. A tela recusa duas regras da mesma
                chave e do mesmo destino valendo no mesmo mês, e a mistura de regras por volume e de percentual fixo na mesma chave e período.
              </li>
              <li>
                “Percentuais Fixos” abre os percentuais digitados de uma chave: escolha a Chave e o Conjunto (Novo, ou um já cadastrado para editar),
                a vigência e o percentual de cada destino, somando 100%, e clique em “Gravar”. Os destinos são sempre os quatro — Matriz, Filial,
                Montagem e Complementar —, em qualquer chave: um rateio pode passar a valer em outra unidade (a Produção em Serviços, por exemplo); o
                destino que não deve receber fica com 0%. As
                regras fixas aparecem na lista com o % Fixo; o lápis delas abre os Percentuais Fixos já na chave e no conjunto da regra, onde se editam e
                se excluem (o conjunto já usado em apurações não se exclui: encerre a vigência).
              </li>
              <li>O quadro vermelho acima da tabela avisa as chaves com meses sem regra (até dezembro do ano que vem): nesses meses, os lançamentos de rateio da chave não vão para nenhuma unidade.</li>
            </ul>
          }
          descricao="As chaves de rateio (aba Rateios do BASE REALIZADO (OPERAÇÃO)): por volume — o volume do destino sobre o da chave, nas listas do mês — ou, desde 14/10/2026, por percentuais fixos digitados, que somam 100% na chave. A chave e o destino são fixos depois de criada a regra; as vigências dizem de que mês a que mês cada regra vale. O volume continua apurado também nas regras fixas (os indicadores de volume leem dele)."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
