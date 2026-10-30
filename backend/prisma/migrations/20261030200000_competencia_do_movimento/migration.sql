-- A competência do movimento (30/10/2026): todo lançamento de contestação guarda a competência do movimento que corrige
-- (um estorno e um lançamento novo por competência); com rateio, ela dá os percentuais. A coluna da competência dos
-- percentuais passa a ser essa.

-- AlterTable
ALTER TABLE "lancamentos_manuais" RENAME COLUMN "competencia_rateio_id" TO "competencia_movimento_id";

-- RenameForeignKey
ALTER TABLE "lancamentos_manuais" RENAME CONSTRAINT "lancamentos_manuais_competencia_rateio_id_fkey" TO "lancamentos_manuais_competencia_movimento_id_fkey";

-- Os já importados: a competência dos movimentos da contestação corrigidos pelos lançamentos, quando é uma só.
UPDATE "lancamentos_manuais" AS l
SET "competencia_movimento_id" = m."competencia_id"
FROM (
    SELECT "contestacao_id", MIN("competencia_id") AS "competencia_id"
    FROM "contestacoes_movimentos"
    WHERE "forma_validacao" = 'LANCAMENTO_MANUAL'
    GROUP BY "contestacao_id"
    HAVING COUNT(DISTINCT "competencia_id") = 1
) AS m
WHERE l."contestacao_id" = m."contestacao_id" AND l."competencia_movimento_id" IS NULL;
