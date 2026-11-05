-- Os Créditos de Impostos importados (04/11/2026, pedido do Adão): a aba Impostos (Lista) do LISTAS REALIZADO (RESULTADOS)
-- traz o Creditado e o Estornado do mês em R$, por unidade (Matriz e Filial) e conta (Matérias Primas, Gastos Gerais
-- Variáveis da Produção e Frete e Descarga). Os percentuais fictícios do SIG - IMPOSTOS (os Creditáveis e os Já Creditados)
-- saem; os novos percentuais se calculam na leitura, sobre o custo da conta na unidade.

-- AlterEnum
ALTER TYPE "TipoImportacao" ADD VALUE 'CREDITOS_IMPOSTOS';

-- Os percentuais fictícios
DELETE FROM "creditos_impostos";

-- AlterTable
ALTER TABLE "creditos_impostos" DROP CONSTRAINT "creditos_impostos_pkey",
DROP COLUMN "creditavel",
DROP COLUMN "ja_creditado",
ADD COLUMN "importacao_id" TEXT NOT NULL,
ADD COLUMN "unidade" INTEGER NOT NULL,
ADD COLUMN "creditado" DECIMAL(65,30) NOT NULL,
ADD COLUMN "estornado" DECIMAL(65,30) NOT NULL,
ADD COLUMN "linha_arquivo" INTEGER NOT NULL,
ADD CONSTRAINT "creditos_impostos_pkey" PRIMARY KEY ("competencia_id", "unidade", "linha_dre_id");

-- CreateIndex
CREATE INDEX "creditos_impostos_importacao_id_idx" ON "creditos_impostos"("importacao_id");

-- AddForeignKey
ALTER TABLE "creditos_impostos" ADD CONSTRAINT "creditos_impostos_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
