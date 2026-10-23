-- AlterTable
ALTER TABLE "divergencias" ADD COLUMN "codigo_centro_custo" TEXT;
ALTER TABLE "divergencias" ADD COLUMN "codigo_conta" TEXT;
ALTER TABLE "divergencias" ADD COLUMN "descricao" TEXT;
ALTER TABLE "divergencias" ADD COLUMN "filial" INTEGER;
ALTER TABLE "divergencias" ADD COLUMN "impacto" DECIMAL;
ALTER TABLE "divergencias" ADD COLUMN "preco_contrato_id" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_importacoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comparacao" BOOLEAN NOT NULL DEFAULT false,
    "competencia_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "hash_arquivo" TEXT NOT NULL,
    "importado_por" TEXT NOT NULL,
    "importado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linhas_lidas" INTEGER NOT NULL DEFAULT 0,
    "linhas_aceitas" INTEGER NOT NULL DEFAULT 0,
    "linhas_rejeitadas" INTEGER NOT NULL DEFAULT 0,
    "linhas_ignoradas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROCESSANDO',
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "motivo_rejeicao" TEXT,
    "relatorio_erros" JSONB,
    "resumo" JSONB,
    "substituida_em" DATETIME,
    CONSTRAINT "importacoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "importacoes_importado_por_fkey" FOREIGN KEY ("importado_por") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_importacoes" ("competencia_id", "hash_arquivo", "id", "importado_em", "importado_por", "linhas_aceitas", "linhas_ignoradas", "linhas_lidas", "linhas_rejeitadas", "motivo_rejeicao", "nome_arquivo", "progresso", "relatorio_erros", "resumo", "status", "substituida_em", "tipo") SELECT "competencia_id", "hash_arquivo", "id", "importado_em", "importado_por", "linhas_aceitas", "linhas_ignoradas", "linhas_lidas", "linhas_rejeitadas", "motivo_rejeicao", "nome_arquivo", "progresso", "relatorio_erros", "resumo", "status", "substituida_em", "tipo" FROM "importacoes";
DROP TABLE "importacoes";
ALTER TABLE "new_importacoes" RENAME TO "importacoes";
CREATE INDEX "importacoes_competencia_id_tipo_idx" ON "importacoes"("competencia_id", "tipo");
CREATE INDEX "importacoes_hash_arquivo_idx" ON "importacoes"("hash_arquivo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

