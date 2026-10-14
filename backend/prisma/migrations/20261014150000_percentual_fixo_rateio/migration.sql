-- O percentual fixo das regras de rateio (14/10/2026): preenchido, substitui o percentual dos volumes.
-- AlterTable
ALTER TABLE "regras_rateio" ADD COLUMN "percentual_fixo" DECIMAL;
