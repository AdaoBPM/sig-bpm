-- Os valores dos centros de custo dos cenários analíticos (13/10/2026): a aba Centros de Custo da tela Premissas.
-- CreateTable
CREATE TABLE "cenarios_centros" (
    "cenario_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL NOT NULL,

    PRIMARY KEY ("cenario_id", "centro_custo_id", "linha_dre_id", "mes"),
    CONSTRAINT "cenarios_centros_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cenarios_centros_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cenarios_centros_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cenarios_centros_centro_custo_id_idx" ON "cenarios_centros"("centro_custo_id");

-- CreateIndex
CREATE INDEX "cenarios_centros_linha_dre_id_idx" ON "cenarios_centros"("linha_dre_id");
