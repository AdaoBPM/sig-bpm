-- Os itens das requisições e das notas fiscais do mês (abas Requisições (Lista) e Notas Fiscais (Lista) do LISTAS REALIZADO (RESULTADOS)).
-- CreateTable
CREATE TABLE "requisicoes_itens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "identificador" TEXT,
    "tipo_movimento" TEXT,
    "nome_tipo_movimento" TEXT,
    "data_baixa" DATETIME,
    "filial" INTEGER,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "projeto" TEXT,
    "tarefa" TEXT,
    "nome_tarefa" TEXT,
    "natureza_orcamentaria" TEXT,
    "conta_contabil" TEXT NOT NULL,
    "descricao_conta" TEXT,
    "codigo_produto" TEXT,
    "descricao_item" TEXT,
    "quantidade" DECIMAL,
    "conta_estoque" TEXT,
    "valor_unitario" DECIMAL,
    "valor_total" DECIMAL NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,
    CONSTRAINT "requisicoes_itens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "requisicoes_itens_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notas_fiscais_itens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "identificador" TEXT,
    "data_emissao" DATETIME,
    "data_saida" DATETIME,
    "numero" TEXT,
    "filial" INTEGER,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "projeto" TEXT,
    "tarefa" TEXT,
    "nome_tarefa" TEXT,
    "codigo_fornecedor" TEXT,
    "fornecedor" TEXT,
    "codigo_produto" TEXT,
    "descricao_item" TEXT,
    "quantidade" DECIMAL,
    "subtotal" DECIMAL,
    "desconto" DECIMAL,
    "valor_total" DECIMAL NOT NULL,
    "cfop" TEXT,
    "tipo_movimento" TEXT,
    "nome_tipo_movimento" TEXT,
    "natureza_orcamentaria" TEXT,
    "conta_contabil" TEXT NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,
    CONSTRAINT "notas_fiscais_itens_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notas_fiscais_itens_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "requisicoes_itens_competencia_id_conta_contabil_idx" ON "requisicoes_itens"("competencia_id", "conta_contabil");

-- CreateIndex
CREATE INDEX "requisicoes_itens_importacao_id_idx" ON "requisicoes_itens"("importacao_id");

-- CreateIndex
CREATE INDEX "notas_fiscais_itens_competencia_id_conta_contabil_idx" ON "notas_fiscais_itens"("competencia_id", "conta_contabil");

-- CreateIndex
CREATE INDEX "notas_fiscais_itens_importacao_id_idx" ON "notas_fiscais_itens"("importacao_id");

