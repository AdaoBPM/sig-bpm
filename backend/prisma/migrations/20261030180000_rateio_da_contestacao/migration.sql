-- Os percentuais de rateio dos lançamentos das contestações (30/10/2026): o estorno e o lançamento novo de um movimento
-- de competência fechada com rateio dividem o valor entre as unidades pelos percentuais da competência do movimento.

-- AlterTable
ALTER TABLE "lancamentos_manuais" ADD COLUMN     "competencia_rateio_id" TEXT;

-- AddForeignKey
ALTER TABLE "lancamentos_manuais" ADD CONSTRAINT "lancamentos_manuais_competencia_rateio_id_fkey" FOREIGN KEY ("competencia_rateio_id") REFERENCES "competencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
