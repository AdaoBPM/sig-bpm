/*
  Warnings:

  - You are about to drop the column `linha` on the `acompanhamentos` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `devolucoes` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `estoque_saldos` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `expedicoes` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `faturamentos` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `medicoes` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `montagens` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `obras` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `obras_encerradas` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `precos_contrato` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `producoes` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `producoes_armadura` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `producoes_pista` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `projetos` table. All the data in the column will be lost.
  - You are about to drop the column `linha` on the `saidas` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "linhas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "receitas_previas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "receita_bruta" DECIMAL NOT NULL,
    "impostos" DECIMAL NOT NULL,
    "receita_liquida" DECIMAL NOT NULL,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "receitas_previas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "receitas_previas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "receitas_previas_precos" (
    "receita_previa_id" TEXT NOT NULL,
    "preco_contrato_id" TEXT NOT NULL,

    PRIMARY KEY ("receita_previa_id", "preco_contrato_id"),
    CONSTRAINT "receitas_previas_precos_receita_previa_id_fkey" FOREIGN KEY ("receita_previa_id") REFERENCES "receitas_previas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "receitas_previas_precos_preco_contrato_id_fkey" FOREIGN KEY ("preco_contrato_id") REFERENCES "precos_contrato" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "volumes_operacionais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "regra_rateio_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "quantidade" DECIMAL NOT NULL,
    "percentual" DECIMAL NOT NULL,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "volumes_operacionais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "volumes_operacionais_regra_rateio_id_fkey" FOREIGN KEY ("regra_rateio_id") REFERENCES "regras_rateio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "volumes_operacionais_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "resultados_apurados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "centro_custo_id" TEXT,
    "linha_dre_id" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "percentual_rol" DECIMAL,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apurado_por" TEXT,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "resultados_apurados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "resultados_apurados_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "resultados_apurados_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "resultados_apurados_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_acompanhamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'DIA',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acompanhamentos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_acompanhamentos" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "acompanhamentos";
DROP TABLE "acompanhamentos";
ALTER TABLE "new_acompanhamentos" RENAME TO "acompanhamentos";
CREATE INDEX "acompanhamentos_competencia_id_idx" ON "acompanhamentos"("competencia_id");
CREATE INDEX "acompanhamentos_importacao_id_idx" ON "acompanhamentos"("importacao_id");
CREATE TABLE "new_devolucoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "tipo_movimento_id" TEXT,
    "valor" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devolucoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_devolucoes" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "tipo_movimento_id", "unidade_medida", "unidade_negocio_id", "valor") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "tipo_movimento_id", "unidade_medida", "unidade_negocio_id", "valor" FROM "devolucoes";
DROP TABLE "devolucoes";
ALTER TABLE "new_devolucoes" RENAME TO "devolucoes";
CREATE INDEX "devolucoes_competencia_id_idx" ON "devolucoes"("competencia_id");
CREATE INDEX "devolucoes_importacao_id_idx" ON "devolucoes"("importacao_id");
CREATE TABLE "new_estoque_saldos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "linha_id" TEXT,
    "saldo_volume" DECIMAL NOT NULL,
    "saldo_valor" DECIMAL NOT NULL,
    "preco_medio" DECIMAL NOT NULL,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "estoque_saldos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_estoque_saldos" ("apurado_em", "competencia_id", "congelado", "id", "obra_id", "preco_medio", "saldo_valor", "saldo_volume") SELECT "apurado_em", "competencia_id", "congelado", "id", "obra_id", "preco_medio", "saldo_valor", "saldo_volume" FROM "estoque_saldos";
DROP TABLE "estoque_saldos";
ALTER TABLE "new_estoque_saldos" RENAME TO "estoque_saldos";
CREATE UNIQUE INDEX "estoque_saldos_competencia_id_obra_id_linha_id_key" ON "estoque_saldos"("competencia_id", "obra_id", "linha_id");
CREATE TABLE "new_expedicoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "valor_frete" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expedicoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_expedicoes" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id", "valor_frete") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id", "valor_frete" FROM "expedicoes";
DROP TABLE "expedicoes";
ALTER TABLE "new_expedicoes" RENAME TO "expedicoes";
CREATE INDEX "expedicoes_competencia_id_linha_id_idx" ON "expedicoes"("competencia_id", "linha_id");
CREATE INDEX "expedicoes_importacao_id_idx" ON "expedicoes"("importacao_id");
CREATE TABLE "new_faturamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "nota_fiscal" TEXT,
    "tipo_movimento_id" TEXT,
    "valor_bruto" DECIMAL,
    "valor_liquido" DECIMAL,
    "quantidade" DECIMAL NOT NULL DEFAULT 0,
    "unidade_medida" TEXT NOT NULL DEFAULT 'UND',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faturamentos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_faturamentos" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "nota_fiscal", "obra_id", "quantidade", "tipo_movimento_id", "unidade_medida", "unidade_negocio_id", "valor_bruto", "valor_liquido") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "nota_fiscal", "obra_id", "quantidade", "tipo_movimento_id", "unidade_medida", "unidade_negocio_id", "valor_bruto", "valor_liquido" FROM "faturamentos";
DROP TABLE "faturamentos";
ALTER TABLE "new_faturamentos" RENAME TO "faturamentos";
CREATE INDEX "faturamentos_competencia_id_idx" ON "faturamentos"("competencia_id");
CREATE INDEX "faturamentos_importacao_id_idx" ON "faturamentos"("importacao_id");
CREATE TABLE "new_medicoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "valor_medido" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medicoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "medicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "medicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "medicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_medicoes" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id", "valor_medido") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id", "valor_medido" FROM "medicoes";
DROP TABLE "medicoes";
ALTER TABLE "new_medicoes" RENAME TO "medicoes";
CREATE INDEX "medicoes_competencia_id_idx" ON "medicoes"("competencia_id");
CREATE INDEX "medicoes_importacao_id_idx" ON "medicoes"("importacao_id");
CREATE TABLE "new_montagens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "montagens_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "montagens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "montagens_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "montagens_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_montagens" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "montagens";
DROP TABLE "montagens";
ALTER TABLE "new_montagens" RENAME TO "montagens";
CREATE INDEX "montagens_competencia_id_idx" ON "montagens"("competencia_id");
CREATE INDEX "montagens_importacao_id_idx" ON "montagens"("importacao_id");
CREATE TABLE "new_obras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "linha_id" TEXT,
    "tipo_venda" TEXT,
    "generica" BOOLEAN NOT NULL DEFAULT false,
    "situacao_cadastro" TEXT NOT NULL DEFAULT 'OK',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "obras_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "obras_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_obras" ("atualizado_em", "codigo", "criado_em", "generica", "id", "nome", "ordem", "situacao_cadastro", "tipo_venda", "unidade_negocio_id") SELECT "atualizado_em", "codigo", "criado_em", "generica", "id", "nome", "ordem", "situacao_cadastro", "tipo_venda", "unidade_negocio_id" FROM "obras";
DROP TABLE "obras";
ALTER TABLE "new_obras" RENAME TO "obras";
CREATE UNIQUE INDEX "obras_codigo_key" ON "obras"("codigo");
CREATE INDEX "obras_situacao_cadastro_idx" ON "obras"("situacao_cadastro");
CREATE TABLE "new_obras_encerradas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "data_encerramento" DATETIME,
    "quantidade" DECIMAL NOT NULL DEFAULT 0,
    "unidade_medida" TEXT NOT NULL DEFAULT 'UND',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obras_encerradas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "obras_encerradas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "obras_encerradas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "obras_encerradas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_obras_encerradas" ("competencia_id", "criado_em", "criado_por", "data_encerramento", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "data_encerramento", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "obras_encerradas";
DROP TABLE "obras_encerradas";
ALTER TABLE "new_obras_encerradas" RENAME TO "obras_encerradas";
CREATE INDEX "obras_encerradas_competencia_id_idx" ON "obras_encerradas"("competencia_id");
CREATE INDEX "obras_encerradas_importacao_id_idx" ON "obras_encerradas"("importacao_id");
CREATE TABLE "new_precos_contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obra_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "linha_id" TEXT,
    "conta_resultado" TEXT NOT NULL,
    "valor_unitario" DECIMAL NOT NULL,
    "valor_total" DECIMAL NOT NULL,
    "etapa" TEXT,
    "importacao_id" TEXT,
    "vigente_desde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "substituido_em" DATETIME,
    CONSTRAINT "precos_contrato_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "precos_contrato_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_precos_contrato" ("conta_resultado", "etapa", "id", "importacao_id", "obra_id", "substituido_em", "valor_total", "valor_unitario", "versao", "vigente_desde") SELECT "conta_resultado", "etapa", "id", "importacao_id", "obra_id", "substituido_em", "valor_total", "valor_unitario", "versao", "vigente_desde" FROM "precos_contrato";
DROP TABLE "precos_contrato";
ALTER TABLE "new_precos_contrato" RENAME TO "precos_contrato";
CREATE INDEX "precos_contrato_obra_id_versao_idx" ON "precos_contrato"("obra_id", "versao");
CREATE INDEX "precos_contrato_substituido_em_idx" ON "precos_contrato"("substituido_em");
CREATE TABLE "new_producoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "grupo" TEXT,
    "secao" TEXT,
    "comprimento" DECIMAL,
    "quantidade_pecas" INTEGER,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes" ("competencia_id", "comprimento", "criado_em", "criado_por", "grupo", "id", "importacao_id", "obra_id", "quantidade", "quantidade_pecas", "secao", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "comprimento", "criado_em", "criado_por", "grupo", "id", "importacao_id", "obra_id", "quantidade", "quantidade_pecas", "secao", "unidade_medida", "unidade_negocio_id" FROM "producoes";
DROP TABLE "producoes";
ALTER TABLE "new_producoes" RENAME TO "producoes";
CREATE INDEX "producoes_competencia_id_linha_id_idx" ON "producoes"("competencia_id", "linha_id");
CREATE INDEX "producoes_importacao_id_idx" ON "producoes"("importacao_id");
CREATE TABLE "new_producoes_armadura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_armadura_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes_armadura" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "producoes_armadura";
DROP TABLE "producoes_armadura";
ALTER TABLE "new_producoes_armadura" RENAME TO "producoes_armadura";
CREATE INDEX "producoes_armadura_competencia_id_idx" ON "producoes_armadura"("competencia_id");
CREATE INDEX "producoes_armadura_importacao_id_idx" ON "producoes_armadura"("importacao_id");
CREATE TABLE "new_producoes_pista" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'PISTA',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_pista_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes_pista" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "producoes_pista";
DROP TABLE "producoes_pista";
ALTER TABLE "new_producoes_pista" RENAME TO "producoes_pista";
CREATE INDEX "producoes_pista_competencia_id_idx" ON "producoes_pista"("competencia_id");
CREATE INDEX "producoes_pista_importacao_id_idx" ON "producoes_pista"("importacao_id");
CREATE TABLE "new_projetos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projetos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projetos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projetos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projetos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_projetos" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "projetos";
DROP TABLE "projetos";
ALTER TABLE "new_projetos" RENAME TO "projetos";
CREATE INDEX "projetos_competencia_id_idx" ON "projetos"("competencia_id");
CREATE INDEX "projetos_importacao_id_idx" ON "projetos"("importacao_id");
CREATE TABLE "new_saidas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "tipo_movimento_id" TEXT,
    "valor" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saidas_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saidas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "saidas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saidas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saidas_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_saidas" ("competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "tipo_movimento_id", "unidade_medida", "unidade_negocio_id", "valor") SELECT "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "obra_id", "quantidade", "tipo_movimento_id", "unidade_medida", "unidade_negocio_id", "valor" FROM "saidas";
DROP TABLE "saidas";
ALTER TABLE "new_saidas" RENAME TO "saidas";
CREATE INDEX "saidas_competencia_id_idx" ON "saidas"("competencia_id");
CREATE INDEX "saidas_importacao_id_idx" ON "saidas"("importacao_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "linhas_tipo_ordem_idx" ON "linhas"("tipo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "linhas_tipo_codigo_key" ON "linhas"("tipo", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "receitas_previas_competencia_id_unidade_negocio_id_natureza_key" ON "receitas_previas"("competencia_id", "unidade_negocio_id", "natureza");

-- CreateIndex
CREATE INDEX "receitas_previas_precos_preco_contrato_id_idx" ON "receitas_previas_precos"("preco_contrato_id");

-- CreateIndex
CREATE UNIQUE INDEX "volumes_operacionais_competencia_id_regra_rateio_id_unidade_negocio_id_key" ON "volumes_operacionais"("competencia_id", "regra_rateio_id", "unidade_negocio_id");

-- CreateIndex
CREATE INDEX "resultados_apurados_competencia_id_linha_dre_id_idx" ON "resultados_apurados"("competencia_id", "linha_dre_id");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_apurados_competencia_id_unidade_negocio_id_centro_custo_id_linha_dre_id_key" ON "resultados_apurados"("competencia_id", "unidade_negocio_id", "centro_custo_id", "linha_dre_id");
