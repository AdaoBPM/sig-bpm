-- AlterTable
ALTER TABLE "contas_resultado" ADD COLUMN "atribuicao_sigla" TEXT;
ALTER TABLE "contas_resultado" ADD COLUMN "departamento_sigla" TEXT;

-- CreateTable
CREATE TABLE "reclassificacoes_conta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo_centro_custo" TEXT NOT NULL,
    "conta_origem_id" TEXT NOT NULL,
    "conta_destino_id" TEXT NOT NULL,
    "motivo" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "reclassificacoes_conta_conta_origem_id_fkey" FOREIGN KEY ("conta_origem_id") REFERENCES "contas_resultado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reclassificacoes_conta_conta_destino_id_fkey" FOREIGN KEY ("conta_destino_id") REFERENCES "contas_resultado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "conta_adotada_id" TEXT,
    "classificado_em" DATETIME,
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
    CONSTRAINT "lancamentos_contabeis_conta_adotada_id_fkey" FOREIGN KEY ("conta_adotada_id") REFERENCES "contas_resultado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos_contabeis" ("alocacao", "atribuicao", "balde", "centro_custo_id", "codigo_centro_custo", "competencia_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_arquivo", "linha_dre_id", "nome_centro_custo", "validacao", "valor_movimento") SELECT "alocacao", "atribuicao", "balde", "centro_custo_id", "codigo_centro_custo", "competencia_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_arquivo", "linha_dre_id", "nome_centro_custo", "validacao", "valor_movimento" FROM "lancamentos_contabeis";
DROP TABLE "lancamentos_contabeis";
ALTER TABLE "new_lancamentos_contabeis" RENAME TO "lancamentos_contabeis";
CREATE INDEX "lancamentos_contabeis_competencia_id_validacao_idx" ON "lancamentos_contabeis"("competencia_id", "validacao");
CREATE INDEX "lancamentos_contabeis_competencia_id_etiqueta_idx" ON "lancamentos_contabeis"("competencia_id", "etiqueta");
CREATE INDEX "lancamentos_contabeis_competencia_id_filial_idx" ON "lancamentos_contabeis"("competencia_id", "filial");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "reclassificacoes_conta_codigo_centro_custo_conta_origem_id_key" ON "reclassificacoes_conta"("codigo_centro_custo", "conta_origem_id");
