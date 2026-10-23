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
    "etapa" TEXT,
    "observacao" TEXT,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'DIA',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acompanhamentos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_acompanhamentos" ("competencia_id", "criado_em", "criado_por", "etapa", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "observacao", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "etapa", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "observacao", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "acompanhamentos";
DROP TABLE "acompanhamentos";
ALTER TABLE "new_acompanhamentos" RENAME TO "acompanhamentos";
CREATE INDEX "acompanhamentos_competencia_id_idx" ON "acompanhamentos"("competencia_id");
CREATE INDEX "acompanhamentos_importacao_id_idx" ON "acompanhamentos"("importacao_id");
CREATE TABLE "new_expedicoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "valor_frete" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "data" DATETIME,
    "numero_carga" TEXT,
    "nome_peca" TEXT,
    "codigo_controle" TEXT,
    "peso_kg" DECIMAL,
    "volume_informado" DECIMAL,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expedicoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_expedicoes" ("codigo_controle", "competencia_id", "criado_em", "criado_por", "data", "id", "importacao_id", "linha_arquivo", "linha_id", "nome_peca", "numero_carga", "obra_id", "peso_kg", "quantidade", "unidade_medida", "unidade_negocio_id", "valor_frete", "volume_informado") SELECT "codigo_controle", "competencia_id", "criado_em", "criado_por", "data", "id", "importacao_id", "linha_arquivo", "linha_id", "nome_peca", "numero_carga", "obra_id", "peso_kg", "quantidade", "unidade_medida", "unidade_negocio_id", "valor_frete", "volume_informado" FROM "expedicoes";
DROP TABLE "expedicoes";
ALTER TABLE "new_expedicoes" RENAME TO "expedicoes";
CREATE INDEX "expedicoes_competencia_id_linha_id_idx" ON "expedicoes"("competencia_id", "linha_id");
CREATE INDEX "expedicoes_importacao_id_idx" ON "expedicoes"("importacao_id");
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
    CONSTRAINT "lancamentos_contabeis_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_conta_adotada_id_fkey" FOREIGN KEY ("conta_adotada_id") REFERENCES "contas_resultado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_contabeis_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos_contabeis" ("alocacao", "atribuicao", "balde", "centro_custo_id", "classificado_em", "codigo_centro_custo", "competencia_id", "conta_adotada_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_arquivo", "linha_dre_id", "nome_centro_custo", "validacao", "valor_movimento") SELECT "alocacao", "atribuicao", "balde", "centro_custo_id", "classificado_em", "codigo_centro_custo", "competencia_id", "conta_adotada_id", "conta_resultado_id", "criado_em", "departamento", "etiqueta", "filial", "id", "importacao_id", "linha_arquivo", "linha_dre_id", "nome_centro_custo", "validacao", "valor_movimento" FROM "lancamentos_contabeis";
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
    "descricao" TEXT NOT NULL,
    "balde" TEXT,
    "linha_dre_id" TEXT,
    "valor" DECIMAL NOT NULL,
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_manuais_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_conta_resultado_id_fkey" FOREIGN KEY ("conta_resultado_id") REFERENCES "contas_resultado" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_manuais_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_lancamentos_manuais" ("atualizado_em", "balde", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "criado_por", "descricao", "filial", "id", "linha_dre_id", "motivo", "valor") SELECT "atualizado_em", "balde", "centro_custo_id", "competencia_id", "conta_resultado_id", "criado_em", "criado_por", "descricao", "filial", "id", "linha_dre_id", "motivo", "valor" FROM "lancamentos_manuais";
DROP TABLE "lancamentos_manuais";
ALTER TABLE "new_lancamentos_manuais" RENAME TO "lancamentos_manuais";
CREATE INDEX "lancamentos_manuais_competencia_id_motivo_idx" ON "lancamentos_manuais"("competencia_id", "motivo");
CREATE TABLE "new_montagens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "data" DATETIME,
    "grupo" TEXT,
    "secao" TEXT,
    "quantidade_pecas" DECIMAL,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "montagens_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "montagens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "montagens_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "montagens_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_montagens" ("competencia_id", "criado_em", "criado_por", "data", "grupo", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "quantidade", "quantidade_pecas", "secao", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "data", "grupo", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "quantidade", "quantidade_pecas", "secao", "unidade_medida", "unidade_negocio_id" FROM "montagens";
DROP TABLE "montagens";
ALTER TABLE "new_montagens" RENAME TO "montagens";
CREATE INDEX "montagens_competencia_id_idx" ON "montagens"("competencia_id");
CREATE INDEX "montagens_importacao_id_idx" ON "montagens"("importacao_id");
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
    "data" DATETIME,
    "codigo_controle" TEXT,
    "produto" TEXT,
    "nome_peca" TEXT,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes" ("codigo_controle", "competencia_id", "comprimento", "criado_em", "criado_por", "data", "grupo", "id", "importacao_id", "linha_arquivo", "linha_id", "nome_peca", "obra_id", "produto", "quantidade", "quantidade_pecas", "secao", "unidade_medida", "unidade_negocio_id") SELECT "codigo_controle", "competencia_id", "comprimento", "criado_em", "criado_por", "data", "grupo", "id", "importacao_id", "linha_arquivo", "linha_id", "nome_peca", "obra_id", "produto", "quantidade", "quantidade_pecas", "secao", "unidade_medida", "unidade_negocio_id" FROM "producoes";
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
    "categoria" TEXT,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_armadura_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes_armadura" ("categoria", "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "categoria", "competencia_id", "criado_em", "criado_por", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "producoes_armadura";
DROP TABLE "producoes_armadura";
ALTER TABLE "new_producoes_armadura" RENAME TO "producoes_armadura";
CREATE INDEX "producoes_armadura_competencia_id_idx" ON "producoes_armadura"("competencia_id");
CREATE INDEX "producoes_armadura_importacao_id_idx" ON "producoes_armadura"("importacao_id");
CREATE TABLE "new_producoes_metalurgia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "finalidade" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_metalurgia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_metalurgia_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_metalurgia_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes_metalurgia" ("competencia_id", "criado_em", "criado_por", "finalidade", "id", "importacao_id", "linha_arquivo", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "finalidade", "id", "importacao_id", "linha_arquivo", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "producoes_metalurgia";
DROP TABLE "producoes_metalurgia";
ALTER TABLE "new_producoes_metalurgia" RENAME TO "producoes_metalurgia";
CREATE INDEX "producoes_metalurgia_competencia_id_finalidade_idx" ON "producoes_metalurgia"("competencia_id", "finalidade");
CREATE INDEX "producoes_metalurgia_importacao_id_idx" ON "producoes_metalurgia"("importacao_id");
CREATE TABLE "new_producoes_pista" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha_id" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "data" DATETIME,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'PISTA',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_pista_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_producoes_pista" ("competencia_id", "criado_em", "criado_por", "data", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id") SELECT "competencia_id", "criado_em", "criado_por", "data", "id", "importacao_id", "linha_arquivo", "linha_id", "obra_id", "quantidade", "unidade_medida", "unidade_negocio_id" FROM "producoes_pista";
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
    "data" DATETIME,
    "nome_peca" TEXT,
    "codigo_peca" TEXT,
    "produto" TEXT,
    "grupo" TEXT,
    "secao" TEXT,
    "comprimento" DECIMAL,
    "peso_kg" DECIMAL,
    "linha_arquivo" INTEGER,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projetos_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projetos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projetos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projetos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_projetos" ("codigo_peca", "competencia_id", "comprimento", "criado_em", "criado_por", "data", "grupo", "id", "importacao_id", "linha_arquivo", "linha_id", "nome_peca", "obra_id", "peso_kg", "produto", "quantidade", "secao", "unidade_medida", "unidade_negocio_id") SELECT "codigo_peca", "competencia_id", "comprimento", "criado_em", "criado_por", "data", "grupo", "id", "importacao_id", "linha_arquivo", "linha_id", "nome_peca", "obra_id", "peso_kg", "produto", "quantidade", "secao", "unidade_medida", "unidade_negocio_id" FROM "projetos";
DROP TABLE "projetos";
ALTER TABLE "new_projetos" RENAME TO "projetos";
CREATE INDEX "projetos_competencia_id_idx" ON "projetos"("competencia_id");
CREATE INDEX "projetos_importacao_id_idx" ON "projetos"("importacao_id");
CREATE TABLE "new_resultados_apurados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "centro_custo_id" TEXT,
    "linha_dre_id" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "percentual_rol" DECIMAL,
    "composicao" JSONB,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apurado_por" TEXT,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "resultados_apurados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "resultados_apurados_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "resultados_apurados_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "resultados_apurados_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_resultados_apurados" ("apurado_em", "apurado_por", "centro_custo_id", "competencia_id", "composicao", "congelado", "id", "linha_dre_id", "percentual_rol", "unidade_negocio_id", "valor") SELECT "apurado_em", "apurado_por", "centro_custo_id", "competencia_id", "composicao", "congelado", "id", "linha_dre_id", "percentual_rol", "unidade_negocio_id", "valor" FROM "resultados_apurados";
DROP TABLE "resultados_apurados";
ALTER TABLE "new_resultados_apurados" RENAME TO "resultados_apurados";
CREATE INDEX "resultados_apurados_competencia_id_linha_dre_id_idx" ON "resultados_apurados"("competencia_id", "linha_dre_id");
CREATE UNIQUE INDEX "resultados_apurados_competencia_id_unidade_negocio_id_centro_custo_id_linha_dre_id_key" ON "resultados_apurados"("competencia_id", "unidade_negocio_id", "centro_custo_id", "linha_dre_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Registros que já existiam: a "última alteração" é a criação. Sem isto, todos
-- ficariam com a hora da migração e o retrato das entradas das competências já
-- apuradas acusaria mudança em todas.
UPDATE "projetos" SET "atualizado_em" = "criado_em";
UPDATE "producoes" SET "atualizado_em" = "criado_em";
UPDATE "producoes_pista" SET "atualizado_em" = "criado_em";
UPDATE "producoes_armadura" SET "atualizado_em" = "criado_em";
UPDATE "producoes_metalurgia" SET "atualizado_em" = "criado_em";
UPDATE "expedicoes" SET "atualizado_em" = "criado_em";
UPDATE "montagens" SET "atualizado_em" = "criado_em";
UPDATE "acompanhamentos" SET "atualizado_em" = "criado_em";
