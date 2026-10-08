-- CreateTable
CREATE TABLE "indicadores_importados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,
    CONSTRAINT "indicadores_importados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "indicadores_importados_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "indicadores_importados_importacao_id_idx" ON "indicadores_importados"("importacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_importados_competencia_id_nome_key" ON "indicadores_importados"("competencia_id", "nome");

