-- CreateTable
CREATE TABLE "conferencias_planilha" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "hash_arquivo" TEXT NOT NULL,
    "enviado_por" TEXT NOT NULL,
    "enviado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valores" JSONB NOT NULL,
    CONSTRAINT "conferencias_planilha_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conferencias_planilha_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "conferencias_planilha_competencia_id_enviado_em_idx" ON "conferencias_planilha"("competencia_id", "enviado_em");

