/*
  Warnings:

  - Added the required column `codigo` to the `linhas_dre` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "usuario_setores" (
    "usuario_id" TEXT NOT NULL,
    "tipo_lista" TEXT NOT NULL,

    PRIMARY KEY ("usuario_id", "tipo_lista"),
    CONSTRAINT "usuario_setores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "competencias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "aberta_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aberta_por" TEXT NOT NULL,
    "apurada_em" DATETIME,
    "apurada_por" TEXT,
    "apuracoes" INTEGER NOT NULL DEFAULT 0,
    "fechada_em" DATETIME,
    "fechada_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "competencias_aberta_por_fkey" FOREIGN KEY ("aberta_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "competencias_apurada_por_fkey" FOREIGN KEY ("apurada_por") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "competencias_fechada_por_fkey" FOREIGN KEY ("fechada_por") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reaberturas_competencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "justificativa" TEXT NOT NULL,
    "reaberta_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reaberta_por" TEXT NOT NULL,
    CONSTRAINT "reaberturas_competencia_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reaberturas_competencia_reaberta_por_fkey" FOREIGN KEY ("reaberta_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "importacoes" (
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
    "status" TEXT NOT NULL DEFAULT 'PROCESSANDO',
    "relatorio_erros" JSONB,
    "substituida_em" DATETIME,
    CONSTRAINT "importacoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "importacoes_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "divergencias" (
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
    CONSTRAINT "divergencias_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "chave_rateio" TEXT,
    "unidade_negocio_id" TEXT,
    CONSTRAINT "centros_custo_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_centros_custo" ("ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "chave_rateio", "codigo_rm", "coligada", "criado_em", "departamento", "departamento_sigla", "id", "nome_controladoria", "nome_rm", "unidade_negocio_id") SELECT "ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "chave_rateio", "codigo_rm", "coligada", "criado_em", "departamento", "departamento_sigla", "id", "nome_controladoria", "nome_rm", "unidade_negocio_id" FROM "centros_custo";
DROP TABLE "centros_custo";
ALTER TABLE "new_centros_custo" RENAME TO "centros_custo";
CREATE UNIQUE INDEX "centros_custo_codigo_rm_key" ON "centros_custo"("codigo_rm");
CREATE INDEX "centros_custo_nome_controladoria_idx" ON "centros_custo"("nome_controladoria");
CREATE INDEX "centros_custo_chave_rateio_idx" ON "centros_custo"("chave_rateio");
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
    "chave_rateio" TEXT,
    "linha_dre_id" TEXT,
    CONSTRAINT "contas_resultado_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_contas_resultado" ("ativo", "atribuicao", "atualizado_em", "chave_rateio", "conta", "criado_em", "departamento", "descricao", "id", "linha_dre_id", "reduzido", "sinal_balancete", "tipo_conta") SELECT "ativo", "atribuicao", "atualizado_em", "chave_rateio", "conta", "criado_em", "departamento", "descricao", "id", "linha_dre_id", "reduzido", "sinal_balancete", "tipo_conta" FROM "contas_resultado";
DROP TABLE "contas_resultado";
ALTER TABLE "new_contas_resultado" RENAME TO "contas_resultado";
CREATE UNIQUE INDEX "contas_resultado_reduzido_key" ON "contas_resultado"("reduzido");
CREATE INDEX "contas_resultado_conta_idx" ON "contas_resultado"("conta");
CREATE INDEX "contas_resultado_linha_dre_id_idx" ON "contas_resultado"("linha_dre_id");
CREATE TABLE "new_linhas_dre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "grupo" TEXT NOT NULL,
    "grupo_sigla" TEXT NOT NULL,
    "atribuicao" TEXT,
    "atribuicao_sigla" TEXT,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "expressao" TEXT,
    "definicao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
INSERT INTO "new_linhas_dre" ("ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "criado_em", "definicao", "descricao", "expressao", "grupo", "grupo_sigla", "id", "ordem", "tipo") SELECT "ativo", "atribuicao", "atribuicao_sigla", "atualizado_em", "criado_em", "definicao", "descricao", "expressao", "grupo", "grupo_sigla", "id", "ordem", "tipo" FROM "linhas_dre";
DROP TABLE "linhas_dre";
ALTER TABLE "new_linhas_dre" RENAME TO "linhas_dre";
CREATE UNIQUE INDEX "linhas_dre_codigo_key" ON "linhas_dre"("codigo");
CREATE INDEX "linhas_dre_grupo_sigla_idx" ON "linhas_dre"("grupo_sigla");
CREATE TABLE "new_regras_rateio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "unidade_destino_id" TEXT NOT NULL,
    "base_fisica" TEXT NOT NULL,
    "origem_do_volume" TEXT NOT NULL,
    "vigencia_inicio" DATETIME NOT NULL,
    "vigencia_fim" DATETIME,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "regras_rateio_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_regras_rateio" ("atualizado_em", "base_fisica", "chave", "criado_em", "id", "origem_do_volume", "unidade_destino_id", "vigencia_fim", "vigencia_inicio") SELECT "atualizado_em", "base_fisica", "chave", "criado_em", "id", "origem_do_volume", "unidade_destino_id", "vigencia_fim", "vigencia_inicio" FROM "regras_rateio";
DROP TABLE "regras_rateio";
ALTER TABLE "new_regras_rateio" RENAME TO "regras_rateio";
CREATE INDEX "regras_rateio_chave_idx" ON "regras_rateio"("chave");
CREATE UNIQUE INDEX "regras_rateio_chave_unidade_destino_id_vigencia_inicio_key" ON "regras_rateio"("chave", "unidade_destino_id", "vigencia_inicio");
CREATE TABLE "new_tabela_estacas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secao" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "preco_unitario" DECIMAL NOT NULL,
    "vigencia_inicio" DATETIME NOT NULL,
    "vigencia_fim" DATETIME,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
INSERT INTO "new_tabela_estacas" ("atualizado_em", "criado_em", "grupo", "id", "preco_unitario", "secao", "vigencia_fim", "vigencia_inicio") SELECT "atualizado_em", "criado_em", "grupo", "id", "preco_unitario", "secao", "vigencia_fim", "vigencia_inicio" FROM "tabela_estacas";
DROP TABLE "tabela_estacas";
ALTER TABLE "new_tabela_estacas" RENAME TO "tabela_estacas";
CREATE UNIQUE INDEX "tabela_estacas_secao_grupo_vigencia_inicio_key" ON "tabela_estacas"("secao", "grupo", "vigencia_inicio");
CREATE TABLE "new_tipos_movimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "retorna_estoque" BOOLEAN NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
INSERT INTO "new_tipos_movimento" ("ativo", "atualizado_em", "codigo", "criado_em", "descricao", "id", "retorna_estoque") SELECT "ativo", "atualizado_em", "codigo", "criado_em", "descricao", "id", "retorna_estoque" FROM "tipos_movimento";
DROP TABLE "tipos_movimento";
ALTER TABLE "new_tipos_movimento" RENAME TO "tipos_movimento";
CREATE UNIQUE INDEX "tipos_movimento_codigo_key" ON "tipos_movimento"("codigo");
CREATE TABLE "new_unidades_negocio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
INSERT INTO "new_unidades_negocio" ("ativo", "atualizado_em", "codigo", "criado_em", "id", "nome", "tipo") SELECT "ativo", "atualizado_em", "codigo", "criado_em", "id", "nome", "tipo" FROM "unidades_negocio";
DROP TABLE "unidades_negocio";
ALTER TABLE "new_unidades_negocio" RENAME TO "unidades_negocio";
CREATE UNIQUE INDEX "unidades_negocio_codigo_key" ON "unidades_negocio"("codigo");
CREATE TABLE "new_usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'GESTAO',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
INSERT INTO "new_usuarios" ("ativo", "atualizado_em", "criado_em", "email", "id", "nome", "senha_hash") SELECT "ativo", "atualizado_em", "criado_em", "email", "id", "nome", "senha_hash" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "usuario_setores_tipo_lista_idx" ON "usuario_setores"("tipo_lista");

-- CreateIndex
CREATE INDEX "competencias_status_idx" ON "competencias"("status");

-- CreateIndex
CREATE UNIQUE INDEX "competencias_ano_mes_key" ON "competencias"("ano", "mes");

-- CreateIndex
CREATE INDEX "reaberturas_competencia_competencia_id_reaberta_em_idx" ON "reaberturas_competencia"("competencia_id", "reaberta_em");

-- CreateIndex
CREATE INDEX "importacoes_competencia_id_tipo_idx" ON "importacoes"("competencia_id", "tipo");

-- CreateIndex
CREATE INDEX "importacoes_hash_arquivo_idx" ON "importacoes"("hash_arquivo");

-- CreateIndex
CREATE INDEX "divergencias_competencia_id_status_idx" ON "divergencias"("competencia_id", "status");

-- CreateIndex
CREATE INDEX "divergencias_status_idx" ON "divergencias"("status");
