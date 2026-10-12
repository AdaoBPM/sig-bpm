-- O histórico de reajustes dos cenários (12/10/2026).
-- CreateTable
CREATE TABLE "cenarios_reajustes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cenario_id" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" TEXT,
    "usuario_nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "modo" TEXT,
    "reajuste" DECIMAL,
    "visao" INTEGER,
    "replicado" BOOLEAN NOT NULL DEFAULT false,
    "contas" JSONB,
    "meses" JSONB,
    "valores" INTEGER NOT NULL DEFAULT 0,
    "soma_antes" DECIMAL,
    "soma_depois" DECIMAL,
    "descricao" TEXT,
    CONSTRAINT "cenarios_reajustes_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "cenarios_reajustes_cenario_id_criado_em_idx" ON "cenarios_reajustes"("cenario_id", "criado_em");
