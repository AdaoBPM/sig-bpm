-- AlterTable
ALTER TABLE "devolucoes" ADD COLUMN "codigo_produto" TEXT;
ALTER TABLE "devolucoes" ADD COLUMN "creditos" DECIMAL;
ALTER TABLE "devolucoes" ADD COLUMN "data" DATETIME;
ALTER TABLE "devolucoes" ADD COLUMN "descricao" TEXT;
ALTER TABLE "devolucoes" ADD COLUMN "filial" INTEGER;
ALTER TABLE "devolucoes" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "devolucoes" ADD COLUMN "movimento" TEXT;
ALTER TABLE "devolucoes" ADD COLUMN "nota_fiscal" TEXT;

-- AlterTable
ALTER TABLE "faturamentos" ADD COLUMN "codigo_produto" TEXT;
ALTER TABLE "faturamentos" ADD COLUMN "data" DATETIME;
ALTER TABLE "faturamentos" ADD COLUMN "descricao" TEXT;
ALTER TABLE "faturamentos" ADD COLUMN "filial" INTEGER;
ALTER TABLE "faturamentos" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "faturamentos" ADD COLUMN "movimento" TEXT;

-- AlterTable
ALTER TABLE "medicoes" ADD COLUMN "cliente" TEXT;
ALTER TABLE "medicoes" ADD COLUMN "execucao_anterior" DECIMAL;
ALTER TABLE "medicoes" ADD COLUMN "execucao_atual" DECIMAL;
ALTER TABLE "medicoes" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "medicoes" ADD COLUMN "tipo_faturamento" TEXT;
ALTER TABLE "medicoes" ADD COLUMN "tipo_lancamento" TEXT;
ALTER TABLE "medicoes" ADD COLUMN "valor_faturamento" DECIMAL;

-- AlterTable
ALTER TABLE "obras_encerradas" ADD COLUMN "linha_arquivo" INTEGER;

-- AlterTable
ALTER TABLE "saidas" ADD COLUMN "codigo_produto" TEXT;
ALTER TABLE "saidas" ADD COLUMN "creditos" DECIMAL;
ALTER TABLE "saidas" ADD COLUMN "data" DATETIME;
ALTER TABLE "saidas" ADD COLUMN "descricao" TEXT;
ALTER TABLE "saidas" ADD COLUMN "filial" INTEGER;
ALTER TABLE "saidas" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "saidas" ADD COLUMN "movimento" TEXT;
ALTER TABLE "saidas" ADD COLUMN "nota_fiscal" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tabela_estacas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secao" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "peca" TEXT NOT NULL,
    "preco_unitario" DECIMAL NOT NULL,
    "preco_liquido" DECIMAL NOT NULL,
    "vigencia_inicio" DATETIME NOT NULL,
    "vigencia_fim" DATETIME,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);
INSERT INTO "new_tabela_estacas" ("atualizado_em", "criado_em", "grupo", "id", "ordem", "preco_unitario", "secao", "vigencia_fim", "vigencia_inicio") SELECT "atualizado_em", "criado_em", "grupo", "id", "ordem", "preco_unitario", "secao", "vigencia_fim", "vigencia_inicio" FROM "tabela_estacas";
DROP TABLE "tabela_estacas";
ALTER TABLE "new_tabela_estacas" RENAME TO "tabela_estacas";
CREATE UNIQUE INDEX "tabela_estacas_secao_grupo_vigencia_inicio_key" ON "tabela_estacas"("secao", "grupo", "vigencia_inicio");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

