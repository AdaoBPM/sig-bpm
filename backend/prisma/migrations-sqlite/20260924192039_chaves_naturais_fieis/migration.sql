-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_centros_custo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coligada" INTEGER,
    "codigo_rm" TEXT,
    "nome_rm" TEXT NOT NULL,
    "nome_controladoria" TEXT,
    "departamento" TEXT,
    "departamento_sigla" TEXT,
    "atribuicao" TEXT,
    "atribuicao_sigla" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "balde" TEXT,
    "unidade_negocio_id" TEXT,
    CONSTRAINT "centros_custo_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_centros_custo" ("ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "balde", "codigo_rm", "coligada", "criado_em", "departamento", "departamento_sigla", "id", "nome_controladoria", "nome_rm", "ordem", "unidade_negocio_id") SELECT "ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "balde", "codigo_rm", "coligada", "criado_em", "departamento", "departamento_sigla", "id", "nome_controladoria", "nome_rm", "ordem", "unidade_negocio_id" FROM "centros_custo";
DROP TABLE "centros_custo";
ALTER TABLE "new_centros_custo" RENAME TO "centros_custo";
CREATE UNIQUE INDEX "centros_custo_codigo_rm_key" ON "centros_custo"("codigo_rm");
CREATE INDEX "centros_custo_nome_controladoria_idx" ON "centros_custo"("nome_controladoria");
CREATE INDEX "centros_custo_balde_idx" ON "centros_custo"("balde");
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
