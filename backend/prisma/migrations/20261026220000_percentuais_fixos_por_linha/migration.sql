-- Os percentuais por linha das regras de percentual fixo (26/10/2026, pedido do Adão): a parte de cada destino de um
-- conjunto fixo dividida entre as linhas da unidade dele, somando 100% no destino. A etapa Linhas da apuração usa estes
-- percentuais na parte de rateio da chave, no lugar da regra da Alocação nas Linhas.

-- CreateTable
CREATE TABLE "regras_rateio_linhas" (
    "id" TEXT NOT NULL,
    "regra_rateio_id" TEXT NOT NULL,
    "linha_id" TEXT NOT NULL,
    "percentual" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "regras_rateio_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regras_rateio_linhas_linha_id_idx" ON "regras_rateio_linhas"("linha_id");

-- CreateIndex
CREATE UNIQUE INDEX "regras_rateio_linhas_regra_rateio_id_linha_id_key" ON "regras_rateio_linhas"("regra_rateio_id", "linha_id");

-- AddForeignKey
ALTER TABLE "regras_rateio_linhas" ADD CONSTRAINT "regras_rateio_linhas_regra_rateio_id_fkey" FOREIGN KEY ("regra_rateio_id") REFERENCES "regras_rateio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_rateio_linhas" ADD CONSTRAINT "regras_rateio_linhas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

