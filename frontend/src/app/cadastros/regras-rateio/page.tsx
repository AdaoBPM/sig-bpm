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
              <li>A chave e o destino não mudam depois de criada a regra: para trocá-los, exclua e crie outra.</li>
              <li>A Linha dos Totais, que dá o volume da regra, se escolhe numa lista com os totais destacados nas Listas Operacionais (Projetos Liberados: Matriz, Metalurgia: Montagem…).</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para ver só as regras vigentes (sem vigência encerrada).</li>
              <li>Com movimentos (lançamentos, valores apurados, registros das listas), a Unidade, a Base Física e a Linha dos Totais e a exclusão ficam bloqueados: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
            </ul>
          }
          descricao="As chaves de rateio por volume (aba Rateios do BASE REALIZADO (OPERAÇÃO)). A chave e o destino são fixos depois de criada a regra."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
