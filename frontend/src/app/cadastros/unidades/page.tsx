import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { PermissionGuard } from "@/components/shared/PermissionGuard";
import { SemLeitura } from "@/components/shared/SemLeitura";

import { ListaCadastroContent } from "../components/ListaCadastroContent";

export default function UnidadesPage() {
  return (
    <ProtectedLayout>
      <PermissionGuard permission="cadastro_unidades:ler" fallback={<SemLeitura />}>
        <ListaCadastroContent
          entidade="unidades"
          rota="/cadastros/unidades"
          titulo="Unidades de Negócio"
          apenasAtivas
          comoUsar={
            <ul>
              <li>Use os filtros nos rótulos das colunas.</li>
              <li>O lápis edita o nome, a ordem e a situação; unidades novas não se criam aqui.</li>
              <li>Marque “Apenas Ativas”, ao lado dos botões, para esconder os registros inativos.</li>
              <li>Com movimentos (lançamentos, valores apurados, registros das listas), o Nome e a exclusão ficam bloqueados: essas informações ligam o cadastro a outras telas. O motivo aparece na edição; os demais campos continuam editáveis.</li>
            </ul>
          }
          descricao="As unidades de negócio da DRE. O código é fixo; o nome, a ordem e a situação são editáveis. O nome identifica a unidade na carga da Estrutura da DRE (as abas Realizado (…) da planilha): ao renomear uma unidade, a carga deixa de reconhecê-la."
        />
      </PermissionGuard>
    </ProtectedLayout>
  );
}
