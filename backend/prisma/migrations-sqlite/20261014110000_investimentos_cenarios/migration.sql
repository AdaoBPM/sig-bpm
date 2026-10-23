-- Os investimentos dos cenários analíticos (13/10/2026): a aba Investimentos da tela Premissas.
-- CreateTable
CREATE TABLE "cenarios_investimentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cenario_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "conta" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ganho_previsto" TEXT,
    "receita_bruta_prevista" DECIMAL,
    "inicio" INTEGER NOT NULL,
    "valor_total" DECIMAL NOT NULL,
    "valor_pos_uso" DECIMAL NOT NULL DEFAULT 0,
    "vida_util" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "cenarios_investimentos_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cenarios_investimentos_cenario_id_idx" ON "cenarios_investimentos"("cenario_id");
