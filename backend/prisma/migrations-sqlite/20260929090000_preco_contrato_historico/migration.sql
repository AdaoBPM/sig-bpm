-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_precos_contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obra_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "etapa" TEXT,
    "linha_texto" TEXT NOT NULL,
    "linha_id" TEXT,
    "conta_resultado" TEXT NOT NULL,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "unidade" TEXT,
    "fornecimento" TEXT,
    "valor_unitario" DECIMAL,
    "valor_total" DECIMAL,
    "percentual_rl" DECIMAL,
    "importacao_id" TEXT,
    "vigente_desde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "substituido_em" DATETIME,
    CONSTRAINT "precos_contrato_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "precos_contrato_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_precos_contrato" ("conta_resultado", "etapa", "id", "importacao_id", "linha_id", "obra_id", "substituido_em", "valor_total", "valor_unitario", "versao", "vigente_desde") SELECT "conta_resultado", "etapa", "id", "importacao_id", "linha_id", "obra_id", "substituido_em", "valor_total", "valor_unitario", "versao", "vigente_desde" FROM "precos_contrato";
DROP TABLE "precos_contrato";
ALTER TABLE "new_precos_contrato" RENAME TO "precos_contrato";
CREATE INDEX "precos_contrato_obra_id_versao_idx" ON "precos_contrato"("obra_id", "versao");
CREATE INDEX "precos_contrato_chave_substituido_em_idx" ON "precos_contrato"("chave", "substituido_em");
CREATE INDEX "precos_contrato_substituido_em_idx" ON "precos_contrato"("substituido_em");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

