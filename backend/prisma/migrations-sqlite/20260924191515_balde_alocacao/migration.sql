/*
  Warnings:

  - You are about to drop the column `chave_rateio` on the `centros_custo` table. All the data in the column will be lost.
  - You are about to drop the column `chave_rateio` on the `contas_resultado` table. All the data in the column will be lost.
  - You are about to drop the column `chave_rateio` on the `lancamentos_contabeis` table. All the data in the column will be lost.
  - You are about to drop the column `chave_rateio` on the `lancamentos_manuais` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_centros_custo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coligada" INTEGER NOT NULL,
    "codigo_rm" TEXT NOT NULL,
    "nome_rm" TEXT NOT NULL,
    "nome_controladoria" TEXT,
    "departamento" TEXT NOT NULL,
    "departamento_sigla" TEXT NOT NULL,
    "atribuicao" TEXT NOT NULL,
    "atribuicao_sigla" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "balde" TEXT,
    "unidade_negocio_id" TEXT,
    CONSTRAINT "centros_custo_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_centros_custo" ("ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "codigo_rm", "coligada", "criado_em", "departamento", "departamento_sigla", "id", "nome_controladoria", "nome_rm", "ordem", "unidade_negocio_id") SELECT "ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "codigo_rm", "coligada", "criado_em", "departamento", "departamento_sigla", "id", "nome_controladoria", "nome_rm", "ordem", "unidade_negocio_id" FROM "centros_custo";
DROP TABLE "centros_custo";
ALTER TABLE "new_centros_custo" RENAME TO "centros_custo";
CREATE UNIQUE INDEX "centros_custo_codigo_rm_key" ON "centros_custo"("codigo_rm");
CREATE INDEX "centros_custo_nome_controladoria_idx" ON "centros_custo"("nome_controladoria");
CREATE INDEX "centros_custo_balde_idx" ON "centros_custo"("balde");
CREATE TABLE "new_contas_resultado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reduzido" INTEGER NOT NULL,
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
INSERT INTO "new_contas_resultado" ("ativo", "atribuicao", "atualizado_em", "conta", "criado_em", "departamento", "descricao", "id", "linha_dre_id", "ordem", "reduzido", "sinal_balancete", "tipo_conta") SELECT "ativo", "atribuicao", "atualizado_em", "conta", "criado_em", "departamento", "descricao", "id", "linha_dre_id", "ordem", "reduzido", "sinal_balancete", "tipo_conta" FROM "contas_resultado";
DROP TABLE "contas_resultado";
ALTER TABLE "new_contas_resultado" RENAME TO "contas_resultado";
CREATE UNIQUE INDEX "contas_resultado_reduzido_key" ON "contas_resultado"("reduzido");
CREATE INDEX "contas_resultado_conta_idx" ON "contas_resultado"("conta");
CREATE INDEX "contas_resultado_linha_dre_id_idx" ON "contas_resultado"("linha_dre_id");
CREATE TABLE "new_lancamentos_contabeis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT NOT NULL,
    "valor_movimento" DECIMAL NOT NULL,
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
INSERT INTO "new_lancamentos_contabeis" ("alocacao", "atribuicao", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_dre_id", "validacao", "valor_movimento") SELECT "alocacao", "atribuicao", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_dre_id", "validacao", "valor_movimento" FROM "lancamentos_contabeis";
DROP TABLE "lancamentos_contabeis";
ALTER TABLE "new_lancamentos_contabeis" RENAME TO "lancamentos_contabeis";
CREATE INDEX "lancamentos_contabeis_competencia_id_validacao_idx" ON "lancamentos_contabeis"("competencia_id", "validacao");
CREATE INDEX "lancamentos_contabeis_competencia_id_etiqueta_idx" ON "lancamentos_contabeis"("competencia_id", "etiqueta");
CREATE INDEX "lancamentos_contabeis_competencia_id_filial_idx" ON "lancamentos_contabeis"("competencia_id", "filial");
CREATE TABLE "new_lancamentos_manuais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT,
    "balde" TEXT,
    "descricao" TEXT NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_manuais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos_manuais" ("atualizado_em", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "criado_por", "descricao", "filial", "id", "linha_dre_id", "motivo", "valor") SELECT "atualizado_em", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "criado_por", "descricao", "filial", "id", "linha_dre_id", "motivo", "valor" FROM "lancamentos_manuais";
DROP TABLE "lancamentos_manuais";
ALTER TABLE "new_lancamentos_manuais" RENAME TO "lancamentos_manuais";
CREATE INDEX "lancamentos_manuais_competencia_id_motivo_idx" ON "lancamentos_manuais"("competencia_id", "motivo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
