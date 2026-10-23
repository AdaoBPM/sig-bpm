-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_estoque_saldos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "linha_id" TEXT,
    "linha_texto" TEXT NOT NULL,
    "movimento_volume" DECIMAL NOT NULL DEFAULT 0,
    "movimento_valor" DECIMAL NOT NULL DEFAULT 0,
    "preco_movimento" DECIMAL,
    "criterio" TEXT,
    "saldo_volume" DECIMAL NOT NULL,
    "saldo_valor" DECIMAL NOT NULL,
    "preco_medio" DECIMAL NOT NULL,
    "importacao_id" TEXT,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "estoque_saldos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_estoque_saldos" ("apurado_em", "competencia_id", "congelado", "id", "linha_id", "obra_id", "preco_medio", "saldo_valor", "saldo_volume") SELECT "apurado_em", "competencia_id", "congelado", "id", "linha_id", "obra_id", "preco_medio", "saldo_valor", "saldo_volume" FROM "estoque_saldos";
DROP TABLE "estoque_saldos";
ALTER TABLE "new_estoque_saldos" RENAME TO "estoque_saldos";
CREATE UNIQUE INDEX "estoque_saldos_competencia_id_obra_id_linha_texto_key" ON "estoque_saldos"("competencia_id", "obra_id", "linha_texto");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

