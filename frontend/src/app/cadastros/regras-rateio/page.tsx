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
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas.</li>
              <li>Use “Novo” para incluir; o lápis edita, e a exclusão fica dentro da edição.</li>
              <li>A chave e o destino não mudam depois de criada a regra: para trocá-los, exclua e crie outra.</li>
            </ul>
          }
          descricao="As chaves de rateio por volume (aba Rateios do BASE REALIZADO (OPERAÇÃO)). A chave e o destino são fixos depois de criada a regra."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
