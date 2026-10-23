-- Cenários Analíticos (19/10/2026): os investimentos trocam o Ganho Previsto e a Receita Bruta Prevista (e o ROI) pela
-- Condição de Pagamento; o quadro de lotação dos centros passa a Colaboradores CLT e PJ (o antigo, só Colaboradores, vai para CLT).

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cenarios_investimentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cenario_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "conta" TEXT NOT NULL,
    "nome_referencia" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL,
    "condicao_pagamento" TEXT,
    "inicio" INTEGER NOT NULL,
    "valor_total" DECIMAL NOT NULL,
    "valor_pos_uso" DECIMAL NOT NULL DEFAULT 0,
    "vida_util" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "cenarios_investimentos_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_cenarios_investimentos" ("atualizado_em", "cenario_id", "conta", "criado_em", "descricao", "id", "inicio", "nome_referencia", "ordem", "unidade", "valor_pos_uso", "valor_total", "vida_util") SELECT "atualizado_em", "cenario_id", "conta", "criado_em", "descricao", "id", "inicio", "nome_referencia", "ordem", "unidade", "valor_pos_uso", "valor_total", "vida_util" FROM "cenarios_investimentos";
DROP TABLE "cenarios_investimentos";
ALTER TABLE "new_cenarios_investimentos" RENAME TO "cenarios_investimentos";
CREATE INDEX "cenarios_investimentos_cenario_id_idx" ON "cenarios_investimentos"("cenario_id");
CREATE UNIQUE INDEX "cenarios_investimentos_cenario_id_nome_referencia_key" ON "cenarios_investimentos"("cenario_id", "nome_referencia");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- O quadro de lotação antigo (Colaboradores) vai para Colaboradores CLT.
UPDATE "cenarios_premissas" SET "venda" = 'LOTACAO_CLT' WHERE "venda" = 'LOTACAO';
