-- CreateTable
CREATE TABLE "unidades_negocio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "centros_custo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coligada" INTEGER NOT NULL,
    "codigo_rm" TEXT NOT NULL,
    "nome_rm" TEXT NOT NULL,
    "nome_controladoria" TEXT,
    "departamento" TEXT NOT NULL,
    "departamento_sigla" TEXT NOT NULL,
    "atribuicao" TEXT NOT NULL,
    "atribuicao_sigla" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "chave_rateio" TEXT,
    "unidade_negocio_id" TEXT,
    CONSTRAINT "centros_custo_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contas_resultado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reduzido" INTEGER NOT NULL,
    "conta" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_conta" TEXT NOT NULL,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "sinal_balancete" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "chave_rateio" TEXT,
    "linha_dre_id" TEXT,
    CONSTRAINT "contas_resultado_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "linhas_dre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "linhas_dre_unidades" (
    "linha_dre_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,

    PRIMARY KEY ("linha_dre_id", "unidade_negocio_id"),
    CONSTRAINT "linhas_dre_unidades_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "linhas_dre_unidades_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "regras_rateio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "unidade_destino_id" TEXT NOT NULL,
    "base_fisica" TEXT NOT NULL,
    "origem_do_volume" TEXT NOT NULL,
    "vigencia_inicio" DATETIME NOT NULL,
    "vigencia_fim" DATETIME,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "regras_rateio_unidade_destino_id_fkey" FOREIGN KEY ("unidade_destino_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tipos_movimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "retorna_estoque" BOOLEAN NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tabela_estacas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secao" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "preco_unitario" DECIMAL NOT NULL,
    "vigencia_inicio" DATETIME NOT NULL,
    "vigencia_fim" DATETIME,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_negocio_codigo_key" ON "unidades_negocio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "centros_custo_codigo_rm_key" ON "centros_custo"("codigo_rm");

-- CreateIndex
CREATE INDEX "centros_custo_nome_controladoria_idx" ON "centros_custo"("nome_controladoria");

-- CreateIndex
CREATE INDEX "centros_custo_chave_rateio_idx" ON "centros_custo"("chave_rateio");

-- CreateIndex
CREATE UNIQUE INDEX "contas_resultado_reduzido_key" ON "contas_resultado"("reduzido");

-- CreateIndex
CREATE INDEX "contas_resultado_conta_idx" ON "contas_resultado"("conta");

-- CreateIndex
CREATE INDEX "contas_resultado_linha_dre_id_idx" ON "contas_resultado"("linha_dre_id");

-- CreateIndex
CREATE UNIQUE INDEX "linhas_dre_ordem_key" ON "linhas_dre"("ordem");

-- CreateIndex
CREATE INDEX "linhas_dre_grupo_sigla_idx" ON "linhas_dre"("grupo_sigla");

-- CreateIndex
CREATE INDEX "linhas_dre_unidades_unidade_negocio_id_idx" ON "linhas_dre_unidades"("unidade_negocio_id");

-- CreateIndex
CREATE INDEX "regras_rateio_chave_idx" ON "regras_rateio"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "regras_rateio_chave_unidade_destino_id_vigencia_inicio_key" ON "regras_rateio"("chave", "unidade_destino_id", "vigencia_inicio");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_movimento_codigo_key" ON "tipos_movimento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tabela_estacas_secao_grupo_vigencia_inicio_key" ON "tabela_estacas"("secao", "grupo", "vigencia_inicio");
