-- CreateTable
CREATE TABLE "receitas_previas_itens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receita_previa_id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "registro_id" TEXT,
    "obra_codigo" TEXT,
    "linha" TEXT,
    "quantidade" DECIMAL,
    "criterio" TEXT NOT NULL,
    "preco_bruto" DECIMAL,
    "preco_liquido" DECIMAL,
    "preco_bruto_id" TEXT,
    "preco_liquido_id" TEXT,
    "receita_bruta" DECIMAL NOT NULL DEFAULT 0,
    "receita_liquida" DECIMAL NOT NULL DEFAULT 0,
    "variacao_estoque" DECIMAL NOT NULL DEFAULT 0,
    "observacao" TEXT,
    CONSTRAINT "receitas_previas_itens_receita_previa_id_fkey" FOREIGN KEY ("receita_previa_id") REFERENCES "receitas_previas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lancamentos_receita" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "componente" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "observacao" TEXT NOT NULL,
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "lancamentos_receita_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lancamentos_receita_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_receitas_previas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "unidade_negocio_id" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "receita_bruta" DECIMAL NOT NULL,
    "impostos" DECIMAL NOT NULL,
    "receita_liquida" DECIMAL NOT NULL,
    "variacao_estoque" DECIMAL NOT NULL DEFAULT 0,
    "apurado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "congelado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "receitas_previas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "receitas_previas_unidade_negocio_id_fkey" FOREIGN KEY ("unidade_negocio_id") REFERENCES "unidades_negocio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_receitas_previas" ("apurado_em", "competencia_id", "congelado", "id", "impostos", "natureza", "receita_bruta", "receita_liquida", "unidade_negocio_id") SELECT "apurado_em", "competencia_id", "congelado", "id", "impostos", "natureza", "receita_bruta", "receita_liquida", "unidade_negocio_id" FROM "receitas_previas";
DROP TABLE "receitas_previas";
ALTER TABLE "new_receitas_previas" RENAME TO "receitas_previas";
CREATE UNIQUE INDEX "receitas_previas_competencia_id_unidade_negocio_id_natureza_key" ON "receitas_previas"("competencia_id", "unidade_negocio_id", "natureza");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "receitas_previas_itens_receita_previa_id_idx" ON "receitas_previas_itens"("receita_previa_id");

-- CreateIndex
CREATE INDEX "lancamentos_receita_competencia_id_idx" ON "lancamentos_receita"("competencia_id");

