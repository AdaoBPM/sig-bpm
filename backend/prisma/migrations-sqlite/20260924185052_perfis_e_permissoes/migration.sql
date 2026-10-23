/*
  Warnings:

  - You are about to drop the `usuario_permissoes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `perfil` on the `usuarios` table. All the data in the column will be lost.
  - Added the required column `perfil_id` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "usuario_permissoes_permissao_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "usuario_permissoes";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "perfis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "perfil_permissoes" (
    "perfil_id" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "acao" TEXT NOT NULL,

    PRIMARY KEY ("perfil_id", "recurso", "acao"),
    CONSTRAINT "perfil_permissoes_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "perfil_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL,
    CONSTRAINT "usuarios_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_usuarios" ("ativo", "atualizado_em", "criado_em", "email", "id", "nome", "ordem", "senha_hash") SELECT "ativo", "atualizado_em", "criado_em", "email", "id", "nome", "ordem", "senha_hash" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "perfis_codigo_key" ON "perfis"("codigo");

-- CreateIndex
CREATE INDEX "perfil_permissoes_recurso_acao_idx" ON "perfil_permissoes"("recurso", "acao");
