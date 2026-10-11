import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function RegrasRateioPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastros:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="regras-rateio"
          rota="/cadastros/regras-rateio"
          titulo="Regras de Rateio"
          apenasAtivas
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas.</li>
              <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>A chave não muda depois de criada a regra: para trocá-la, exclua e crie outra.</li>
              <li>A Linha dos Totais, que dá o volume da regra, se escolhe numa lista com os totais destacados nas Listas Operacionais — só os da Chave escolhida (Metalurgia: Matriz, Filial, Montagem e Complementar, na chave METALURGIA…).</li>
              <li>O destino, a unidade que recebe e a base física saem da Linha dos Totais: Projetos Liberados: Matriz vai para a Matriz; Metalurgia: Complementar, para a Complementar (unidade Serviços); as pistas, para a Filial.</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para ver só as regras vigentes (sem vigência encerrada).</li>
              <li>Com movimentos (as apurações de rateio), a Linha dos Totais e a exclusão ficam bloqueadas: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
            </ul>
          }
          descricao="As chaves de rateio por volume (aba Rateios do BASE REALIZADO (OPERAÇÃO)). A chave e o destino são fixos depois de criada a regra."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
