-- Os valores dos centros de custo dos cenários analíticos por grupo da Controladoria (13/10/2026; antes, por centro).
-- A tabela estava vazia no banco da ferramenta quando a mudança foi feita.
DROP TABLE "cenarios_centros";

-- CreateTable
CREATE TABLE "cenarios_centros" (
    "cenario_id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL NOT NULL,

    PRIMARY KEY ("cenario_id", "grupo", "linha_dre_id", "mes"),
    CONSTRAINT "cenarios_centros_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cenarios_centros_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cenarios_centros_linha_dre_id_idx" ON "cenarios_centros"("linha_dre_id");
