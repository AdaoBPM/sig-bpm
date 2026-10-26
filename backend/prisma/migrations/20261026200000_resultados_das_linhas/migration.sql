-- Os Resultados por Linha no Fechamento Mensal (26/10/2026, pedido do Adão): a etapa Linhas da apuração grava o valor de
-- cada linha (e da Sem Linha de cada unidade) em cada item da DRE, congelado com a competência no fechamento; a
-- competência guarda o resumo da etapa (os passos da Alocação nas Linhas, os documentos e os avisos). As competências
-- fechadas antes disso ficam sem as linhas até alguém gravá-las na etapa Linhas do mês.

-- AlterTable
ALTER TABLE "competencias" ADD COLUMN     "apuracao_linhas" JSON;

-- CreateTable
CREATE TABLE "resultados_linhas" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "linha_id" TEXT,
    "linha_dre_id" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "na_obra" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "resultados_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resultados_linhas_competencia_id_linha_id_idx" ON "resultados_linhas"("competencia_id", "linha_id");

-- CreateIndex
CREATE INDEX "resultados_linhas_linha_id_idx" ON "resultados_linhas"("linha_id");

-- AddForeignKey
ALTER TABLE "resultados_linhas" ADD CONSTRAINT "resultados_linhas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_linhas" ADD CONSTRAINT "resultados_linhas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_linhas" ADD CONSTRAINT "resultados_linhas_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

