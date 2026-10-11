-- Estrutura dos Indicadores (cadastro da Controladoria, 11/10/2026): tabela nova; a carga dos 114 indicadores
-- (estruturaInicialIndicadores.ts) é feita pela carga inicial.
-- CreateTable
CREATE TABLE "indicadores_estrutura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "grupo" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "nome" TEXT NOT NULL,
    "sentido" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "descricao" TEXT,
    "formula" TEXT,
    "modo" TEXT NOT NULL,
    "peso" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_estrutura_nome_key" ON "indicadores_estrutura"("nome");

-- CreateIndex
CREATE INDEX "indicadores_estrutura_ordem_idx" ON "indicadores_estrutura"("ordem");

