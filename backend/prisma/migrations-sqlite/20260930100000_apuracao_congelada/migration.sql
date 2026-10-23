-- AlterTable
ALTER TABLE "competencias" ADD COLUMN "entradas_apuradas" JSONB;

-- AlterTable
ALTER TABLE "reaberturas_competencia" ADD COLUMN "fechamento_anterior_em" DATETIME;
ALTER TABLE "reaberturas_competencia" ADD COLUMN "fechamento_anterior_por" TEXT;

