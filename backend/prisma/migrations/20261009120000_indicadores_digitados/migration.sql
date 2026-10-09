-- CreateTable
CREATE TABLE "indicadores_digitados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL NOT NULL,
    "digitado_por" TEXT NOT NULL,
    "digitado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "indicadores_digitados_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_digitados_competencia_id_nome_key" ON "indicadores_digitados"("competencia_id", "nome");
