-- O comparativo entre cenários (12/10/2026): o cenário comparado, as variações máximas dos totais e as justificativas.
ALTER TABLE "cenarios" ADD COLUMN "comparado_com_id" TEXT REFERENCES "cenarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cenarios" ADD COLUMN "variacoes_maximas" JSONB;

-- CreateTable
CREATE TABLE "cenarios_justificativas" (
    "cenario_id" TEXT NOT NULL,
    "visao" INTEGER NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuario_nome" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL,

    PRIMARY KEY ("cenario_id", "visao", "linha_dre_id"),
    CONSTRAINT "cenarios_justificativas_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cenarios_justificativas_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cenarios_justificativas_linha_dre_id_idx" ON "cenarios_justificativas"("linha_dre_id");
