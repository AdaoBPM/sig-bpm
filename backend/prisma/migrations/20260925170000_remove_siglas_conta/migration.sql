-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contas_resultado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reduzido" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_conta" TEXT NOT NULL,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "sinal_balancete" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "balde" TEXT,
    "linha_dre_id" TEXT,
    CONSTRAINT "contas_resultado_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_contas_resultado" ("ativo", "atribuicao", "atualizado_em", "balde", "conta", "criado_em", "departamento", "descricao", "id", "linha_dre_id", "ordem", "reduzido", "sinal_balancete", "tipo_conta") SELECT "ativo", "atribuicao", "atualizado_em", "balde", "conta", "criado_em", "departamento", "descricao", "id", "linha_dre_id", "ordem", "reduzido", "sinal_balancete", "tipo_conta" FROM "contas_resultado";
DROP TABLE "contas_resultado";
ALTER TABLE "new_contas_resultado" RENAME TO "contas_resultado";
CREATE UNIQUE INDEX "contas_resultado_reduzido_key" ON "contas_resultado"("reduzido");
CREATE INDEX "contas_resultado_conta_idx" ON "contas_resultado"("conta");
CREATE INDEX "contas_resultado_linha_dre_id_idx" ON "contas_resultado"("linha_dre_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

