-- CreateTable
CREATE TABLE "usuario_departamentos" (
    "usuario_id" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,

    PRIMARY KEY ("usuario_id", "departamento"),
    CONSTRAINT "usuario_departamentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_perfis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    "recorte_setor" BOOLEAN NOT NULL DEFAULT false,
    "recorte_departamento" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_perfis" ("ativo", "atualizado_em", "codigo", "criado_em", "descricao", "id", "nome", "ordem", "sistema") SELECT "ativo", "atualizado_em", "codigo", "criado_em", "descricao", "id", "nome", "ordem", "sistema" FROM "perfis";
DROP TABLE "perfis";
ALTER TABLE "new_perfis" RENAME TO "perfis";
CREATE UNIQUE INDEX "perfis_codigo_key" ON "perfis"("codigo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

