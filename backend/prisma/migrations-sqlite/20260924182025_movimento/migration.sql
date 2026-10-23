-- CreateTable
CREATE TABLE "obras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade_negocio_id" TEXT,
    "linha" TEXT,
    "tipo_venda" TEXT,
    "generica" BOOLEAN NOT NULL DEFAULT false,
    "situacao_cadastro" TEXT NOT NULL DEFAULT 'OK',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "obras_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "precos_contrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obra_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "linha" TEXT NOT NULL,
    "conta_resultado" TEXT NOT NULL,
    "valor_unitario" DECIMAL NOT NULL,
    "valor_total" DECIMAL NOT NULL,
    "etapa" TEXT,
    "importacao_id" TEXT,
    "vigente_desde" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "substituido_em" DATETIME,
    CONSTRAINT "precos_contrato_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lancamentos_contabeis" (
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
    "chave_rateio" TEXT,
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

-- CreateTable
CREATE TABLE "lancamentos_manuais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "filial" INTEGER NOT NULL,
    "centro_custo_id" TEXT,
    "conta_resultado_id" TEXT,
    "chave_rateio" TEXT,
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

-- CreateTable
CREATE TABLE "estoque_saldos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "linha" TEXT NOT NULL,
    "saldo_volume" DECIMAL NOT NULL,
    "saldo_valor" DECIMAL NOT NULL,
    "preco_medio" DECIMAL NOT NULL,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "estoque_saldos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estoque_saldos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projetos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projetos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projetos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projetos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "producoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "grupo" TEXT,
    "secao" TEXT,
    "comprimento" DECIMAL,
    "quantidade_pecas" INTEGER,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "producoes_pista" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'PISTA',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_pista_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_pista_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "producoes_armadura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_armadura_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_armadura_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "producoes_metalurgia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "finalidade" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'KG',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "producoes_metalurgia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "producoes_metalurgia_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "producoes_metalurgia_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expedicoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "valor_frete" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expedicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "expedicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "montagens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "montagens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "montagens_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "montagens_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "acompanhamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'DIA',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acompanhamentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acompanhamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medicoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "valor_medido" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medicoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "medicoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "medicoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "devolucoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "tipo_movimento_id" TEXT,
    "valor" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "devolucoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "devolucoes_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saidas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "tipo_movimento_id" TEXT,
    "valor" DECIMAL,
    "quantidade" DECIMAL NOT NULL,
    "unidade_medida" TEXT NOT NULL DEFAULT 'M3',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saidas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "saidas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saidas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "saidas_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "faturamentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "nota_fiscal" TEXT,
    "tipo_movimento_id" TEXT,
    "valor_bruto" DECIMAL,
    "valor_liquido" DECIMAL,
    "quantidade" DECIMAL NOT NULL DEFAULT 0,
    "unidade_medida" TEXT NOT NULL DEFAULT 'UND',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "faturamentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "faturamentos_tipo_movimento_id_fkey" FOREIGN KEY ("tipo_movimento_id") REFERENCES "tipos_movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "obras_encerradas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT,
    "unidade_negocio_id" TEXT,
    "obra_id" TEXT,
    "linha" TEXT,
    "data_encerramento" DATETIME,
    "quantidade" DECIMAL NOT NULL DEFAULT 0,
    "unidade_medida" TEXT NOT NULL DEFAULT 'UND',
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obras_encerradas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "obras_encerradas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "obras_encerradas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_divergencias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "conta_resultado_id" TEXT,
    "centro_custo_id" TEXT,
    "obra_id" TEXT,
    "valor_gravado" DECIMAL NOT NULL,
    "valor_recebido" DECIMAL NOT NULL,
    "diferenca" DECIMAL NOT NULL,
    "detectada_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "justificativa" TEXT,
    "tratada_em" DATETIME,
    "tratada_por" TEXT,
    CONSTRAINT "divergencias_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "divergencias_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "divergencias_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_divergencias" ("centro_custo_id", "competencia_id", "conta_resultado_id", "detectada_em", "diferenca", "id", "importacao_id", "justificativa", "obra_id", "status", "tipo", "tratada_em", "tratada_por", "valor_gravado", "valor_recebido") SELECT "centro_custo_id", "competencia_id", "conta_resultado_id", "detectada_em", "diferenca", "id", "importacao_id", "justificativa", "obra_id", "status", "tipo", "tratada_em", "tratada_por", "valor_gravado", "valor_recebido" FROM "divergencias";
DROP TABLE "divergencias";
ALTER TABLE "new_divergencias" RENAME TO "divergencias";
CREATE INDEX "divergencias_competencia_id_status_idx" ON "divergencias"("competencia_id", "status");
CREATE INDEX "divergencias_status_idx" ON "divergencias"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "obras_codigo_key" ON "obras"("codigo");

-- CreateIndex
CREATE INDEX "obras_situacao_cadastro_idx" ON "obras"("situacao_cadastro");

-- CreateIndex
CREATE INDEX "precos_contrato_obra_id_versao_idx" ON "precos_contrato"("obra_id", "versao");

-- CreateIndex
CREATE INDEX "precos_contrato_substituido_em_idx" ON "precos_contrato"("substituido_em");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_competencia_id_validacao_idx" ON "lancamentos_contabeis"("competencia_id", "validacao");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_competencia_id_etiqueta_idx" ON "lancamentos_contabeis"("competencia_id", "etiqueta");

-- CreateIndex
CREATE INDEX "lancamentos_contabeis_competencia_id_filial_idx" ON "lancamentos_contabeis"("competencia_id", "filial");

-- CreateIndex
CREATE INDEX "lancamentos_manuais_competencia_id_motivo_idx" ON "lancamentos_manuais"("competencia_id", "motivo");

-- CreateIndex
CREATE UNIQUE INDEX "estoque_saldos_competencia_id_obra_id_linha_key" ON "estoque_saldos"("competencia_id", "obra_id", "linha");

-- CreateIndex
CREATE INDEX "projetos_competencia_id_idx" ON "projetos"("competencia_id");

-- CreateIndex
CREATE INDEX "projetos_importacao_id_idx" ON "projetos"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_competencia_id_linha_idx" ON "producoes"("competencia_id", "linha");

-- CreateIndex
CREATE INDEX "producoes_importacao_id_idx" ON "producoes"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_pista_competencia_id_idx" ON "producoes_pista"("competencia_id");

-- CreateIndex
CREATE INDEX "producoes_pista_importacao_id_idx" ON "producoes_pista"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_armadura_competencia_id_idx" ON "producoes_armadura"("competencia_id");

-- CreateIndex
CREATE INDEX "producoes_armadura_importacao_id_idx" ON "producoes_armadura"("importacao_id");

-- CreateIndex
CREATE INDEX "producoes_metalurgia_competencia_id_finalidade_idx" ON "producoes_metalurgia"("competencia_id", "finalidade");

-- CreateIndex
CREATE INDEX "producoes_metalurgia_importacao_id_idx" ON "producoes_metalurgia"("importacao_id");

-- CreateIndex
CREATE INDEX "expedicoes_competencia_id_linha_idx" ON "expedicoes"("competencia_id", "linha");

-- CreateIndex
CREATE INDEX "expedicoes_importacao_id_idx" ON "expedicoes"("importacao_id");

-- CreateIndex
CREATE INDEX "montagens_competencia_id_idx" ON "montagens"("competencia_id");

-- CreateIndex
CREATE INDEX "montagens_importacao_id_idx" ON "montagens"("importacao_id");

-- CreateIndex
CREATE INDEX "acompanhamentos_competencia_id_idx" ON "acompanhamentos"("competencia_id");

-- CreateIndex
CREATE INDEX "acompanhamentos_importacao_id_idx" ON "acompanhamentos"("importacao_id");

-- CreateIndex
CREATE INDEX "medicoes_competencia_id_idx" ON "medicoes"("competencia_id");

-- CreateIndex
CREATE INDEX "medicoes_importacao_id_idx" ON "medicoes"("importacao_id");

-- CreateIndex
CREATE INDEX "devolucoes_competencia_id_idx" ON "devolucoes"("competencia_id");

-- CreateIndex
CREATE INDEX "devolucoes_importacao_id_idx" ON "devolucoes"("importacao_id");

-- CreateIndex
CREATE INDEX "saidas_competencia_id_idx" ON "saidas"("competencia_id");

-- CreateIndex
CREATE INDEX "saidas_importacao_id_idx" ON "saidas"("importacao_id");

-- CreateIndex
CREATE INDEX "faturamentos_competencia_id_idx" ON "faturamentos"("competencia_id");

-- CreateIndex
CREATE INDEX "faturamentos_importacao_id_idx" ON "faturamentos"("importacao_id");

-- CreateIndex
CREATE INDEX "obras_encerradas_competencia_id_idx" ON "obras_encerradas"("competencia_id");

-- CreateIndex
CREATE INDEX "obras_encerradas_importacao_id_idx" ON "obras_encerradas"("importacao_id");
