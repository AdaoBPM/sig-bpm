-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_lancamentos_manuais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT,
    "descricao" TEXT NOT NULL,
    "balde" TEXT,
    "linha_dre_id" TEXT,
    "valor" DECIMAL NOT NULL,
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_manuais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos_manuais" ("atualizado_em", "balde", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "criado_por", "descricao", "filial", "id", "linha_dre_id", "motivo", "valor") SELECT "atualizado_em", "balde", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "criado_por", "descricao", "filial", "id", "linha_dre_id", "motivo", "valor" FROM "lancamentos_manuais";
DROP TABLE "lancamentos_manuais";
ALTER TABLE "new_lancamentos_manuais" RENAME TO "lancamentos_manuais";
CREATE INDEX "lancamentos_manuais_competencia_id_motivo_idx" ON "lancamentos_manuais"("competencia_id", "motivo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

