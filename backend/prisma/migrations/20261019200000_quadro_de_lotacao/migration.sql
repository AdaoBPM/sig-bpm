-- Os colaboradores do mês por centro de custo (aba Quadro de Lotação do LISTAS REALIZADO (OPERAÇÃO), 19/10/2026).
-- CreateTable
CREATE TABLE "lotacoes_centros" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competencia_id" TEXT NOT NULL,
    "importacao_id" TEXT NOT NULL,
    "centro_custo" TEXT NOT NULL,
    "unidade" TEXT,
    "departamento" TEXT,
    "atribuicao" TEXT,
    "clt" INTEGER NOT NULL,
    "pj" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "linha_arquivo" INTEGER NOT NULL,
    CONSTRAINT "lotacoes_centros_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lotacoes_centros_importacao_id_fkey" FOREIGN KEY ("importacao_id") REFERENCES "importacoes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "lotacoes_centros_competencia_id_idx" ON "lotacoes_centros"("competencia_id");

-- CreateIndex
CREATE INDEX "lotacoes_centros_importacao_id_idx" ON "lotacoes_centros"("importacao_id");
