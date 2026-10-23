-- CreateTable
CREATE TABLE "metas_importadas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,
    CONSTRAINT "metas_importadas_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "metas_importadas_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "metas_importadas_importacao_id_idx" ON "metas_importadas"("importacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "metas_importadas_competencia_id_nome_key" ON "metas_importadas"("competencia_id", "nome");
