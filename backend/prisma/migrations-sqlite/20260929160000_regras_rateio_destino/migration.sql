-- DropIndex
DROP INDEX "volumes_operacionais_competencia_id_regra_rateio_id_unidade_negocio_id_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_regras_rateio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "unidade_destino_id" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "base_fisica" TEXT NOT NULL,
    "origem_do_volume" TEXT NOT NULL,
    "vigencia_inicio" DATETIME NOT NULL,
    "vigencia_fim" DATETIME,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "regras_rateio_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_regras_rateio" ("atualizado_em", "base_fisica", "chave", "criado_em", "id", "ordem", "origem_do_volume", "unidade_destino_id", "vigencia_fim", "vigencia_inicio") SELECT "atualizado_em", "base_fisica", "chave", "criado_em", "id", "ordem", "origem_do_volume", "unidade_destino_id", "vigencia_fim", "vigencia_inicio" FROM "regras_rateio";
DROP TABLE "regras_rateio";
ALTER TABLE "new_regras_rateio" RENAME TO "regras_rateio";
CREATE INDEX "regras_rateio_chave_idx" ON "regras_rateio"("chave");
CREATE UNIQUE INDEX "regras_rateio_chave_destino_vigencia_inicio_key" ON "regras_rateio"("chave", "destino", "vigencia_inicio");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "volumes_operacionais_competencia_id_regra_rateio_id_key" ON "volumes_operacionais"("competencia_id", "regra_rateio_id");

