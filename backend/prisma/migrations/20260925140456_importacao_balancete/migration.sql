/*
  Warnings:

  - Added the required column `linha_arquivo` to the `lancamentos_contabeis` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_importacoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "hash_arquivo" TEXT NOT NULL,
    "importado_por" TEXT NOT NULL,
    "importado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linhas_lidas" INTEGER NOT NULL DEFAULT 0,
    "linhas_aceitas" INTEGER NOT NULL DEFAULT 0,
    "linhas_rejeitadas" INTEGER NOT NULL DEFAULT 0,
    "linhas_ignoradas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROCESSANDO',
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "motivo_rejeicao" TEXT,
    "relatorio_erros" JSONB,
    "resumo" JSONB,
    "substituida_em" DATETIME,
    CONSTRAINT "importacoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "importacoes_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_importacoes" ("competencia_id", "hash_arquivo", "id", "importado_em", "importado_por", "linhas_aceitas", "linhas_lidas", "linhas_rejeitadas", "nome_arquivo", "relatorio_erros", "status", "substituida_em", "tipo") SELECT "competencia_id", "hash_arquivo", "id", "importado_em", "importado_por", "linhas_aceitas", "linhas_lidas", "linhas_rejeitadas", "nome_arquivo", "relatorio_erros", "status", "substituida_em", "tipo" FROM "importacoes";
DROP TABLE "importacoes";
ALTER TABLE "new_importacoes" RENAME TO "importacoes";
CREATE INDEX "importacoes_competencia_id_tipo_idx" ON "importacoes"("competencia_id", "tipo");
CREATE INDEX "importacoes_hash_arquivo_idx" ON "importacoes"("hash_arquivo");
CREATE TABLE "new_lancamentos_contabeis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT NOT NULL,
    "valor_movimento" DECIMAL NOT NULL,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "linha_arquivo" INTEGER NOT NULL,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "linha_dre_id" TEXT,
    "balde" TEXT,
    "alocacao" TEXT,
    "etiqueta" TEXT,
    "validacao" TEXT NOT NULL DEFAULT 'OK',
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lancamentos_contabeis_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos_contabeis" ("alocacao", "atribuicao", "balde", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_dre_id", "validacao", "valor_movimento") SELECT "alocacao", "atribuicao", "balde", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_dre_id", "validacao", "valor_movimento" FROM "lancamentos_contabeis";
DROP TABLE "lancamentos_contabeis";
ALTER TABLE "new_lancamentos_contabeis" RENAME TO "lancamentos_contabeis";
CREATE INDEX "lancamentos_contabeis_competencia_id_validacao_idx" ON "lancamentos_contabeis"("competencia_id", "validacao");
CREATE INDEX "lancamentos_contabeis_competencia_id_etiqueta_idx" ON "lancamentos_contabeis"("competencia_id", "etiqueta");
CREATE INDEX "lancamentos_contabeis_competencia_id_filial_idx" ON "lancamentos_contabeis"("competencia_id", "filial");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
