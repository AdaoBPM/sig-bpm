-- CreateTable
CREATE TABLE "estoque_saldos_iniciais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "linha_id" TEXT,
    "linha_texto" TEXT NOT NULL,
    "saldo_volume" DECIMAL NOT NULL,
    "saldo_valor" DECIMAL NOT NULL,
    CONSTRAINT "estoque_saldos_iniciais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_iniciais_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_iniciais_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_iniciais_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- O saldo inicial do estoque sai da competência de 12/2025 e vai para o
-- primeiro mês da ferramenta (01/2026), numa tabela própria: 12/2025 só
-- existia para guardá-lo e deixa de existir.
INSERT INTO "estoque_saldos_iniciais" ("id", "competencia_id", "importacao_id", "obra_id", "linha_id", "linha_texto", "saldo_volume", "saldo_valor")
SELECT s."id", j."id", s."importacao_id", s."obra_id", s."linha_id", s."linha_texto", s."saldo_volume", s."saldo_valor"
FROM "estoque_saldos" s
JOIN "competencias" d ON d."id" = s."competencia_id" AND d."ano" = 2025 AND d."mes" = 12
JOIN "competencias" j ON j."ano" = 2026 AND j."mes" = 1
WHERE s."importacao_id" IS NOT NULL;

UPDATE "importacoes" SET "competencia_id" = (SELECT "id" FROM "competencias" WHERE "ano" = 2026 AND "mes" = 1)
WHERE "tipo" = 'ESTOQUE_INICIAL'
  AND "competencia_id" IN (SELECT "id" FROM "competencias" WHERE "ano" = 2025 AND "mes" = 12)
  AND EXISTS (SELECT 1 FROM "competencias" WHERE "ano" = 2026 AND "mes" = 1);

DELETE FROM "estoque_saldos"
WHERE "importacao_id" IS NOT NULL
  AND "competencia_id" IN (SELECT "id" FROM "competencias" WHERE "ano" = 2025 AND "mes" = 12)
  AND EXISTS (SELECT 1 FROM "competencias" WHERE "ano" = 2026 AND "mes" = 1);

-- A competência de 12/2025 sai só se não guardar mais nada.
DELETE FROM "competencias"
WHERE "ano" = 2025 AND "mes" = 12 AND "apurada_em" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "importacoes" i WHERE i."competencia_id" = "competencias"."id")
  AND NOT EXISTS (SELECT 1 FROM "estoque_saldos" e WHERE e."competencia_id" = "competencias"."id")
  AND NOT EXISTS (SELECT 1 FROM "lancamentos_contabeis" l WHERE l."competencia_id" = "competencias"."id");

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
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "estoque_saldos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_estoque_saldos" ("apurado_em", "competencia_id", "congelado", "criterio", "id", "linha_id", "linha_texto", "movimento_valor", "movimento_volume", "obra_id", "preco_medio", "preco_movimento", "saldo_valor", "saldo_volume") SELECT "apurado_em", "competencia_id", "congelado", "criterio", "id", "linha_id", "linha_texto", "movimento_valor", "movimento_volume", "obra_id", "preco_medio", "preco_movimento", "saldo_valor", "saldo_volume" FROM "estoque_saldos";
DROP TABLE "estoque_saldos";
ALTER TABLE "new_estoque_saldos" RENAME TO "estoque_saldos";
CREATE UNIQUE INDEX "estoque_saldos_competencia_id_obra_id_linha_texto_key" ON "estoque_saldos"("competencia_id", "obra_id", "linha_texto");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "estoque_saldos_iniciais_competencia_id_obra_id_linha_texto_key" ON "estoque_saldos_iniciais"("competencia_id", "obra_id", "linha_texto");

