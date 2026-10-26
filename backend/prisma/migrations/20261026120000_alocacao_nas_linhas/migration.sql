-- A Alocação nas Linhas (26/10/2026, pedido do Adão; Cadastros da Controladoria › Controladoria): as regras com que os
-- Resultados por Linha levam às linhas os custos sem tarefa — um centro de custo, ou o balde dos centros sem regra
-- própria, vai para uma linha (100%) ou para uma base por linha (o m³ produzido, os dias de acompanhamento…), com a
-- vigência. Mantidas na tela pelos usuários da Controladoria; não entram na apuração da DRE.
-- CreateTable
CREATE TABLE "alocacoes_linhas" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "centro_custo_id" TEXT,
    "balde" "BaldeAlocacao",
    "destino" TEXT NOT NULL,
    "linha_id" TEXT,
    "base" TEXT,
    "vigencia_inicio" TIMESTAMP(3) NOT NULL,
    "vigencia_fim" TIMESTAMP(3),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alocacoes_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alocacoes_linhas_centro_custo_id_idx" ON "alocacoes_linhas"("centro_custo_id");

-- CreateIndex
CREATE INDEX "alocacoes_linhas_balde_idx" ON "alocacoes_linhas"("balde");

-- AddForeignKey
ALTER TABLE "alocacoes_linhas" ADD CONSTRAINT "alocacoes_linhas_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes_linhas" ADD CONSTRAINT "alocacoes_linhas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

