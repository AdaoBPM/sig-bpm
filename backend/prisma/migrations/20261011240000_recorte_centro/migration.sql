-- Recorte por centro de custo (11/10/2026): no perfil, o recorte; no usuário, a gestão
-- (departamento) e os centros de custo que ele alcança.
ALTER TABLE "perfis" ADD COLUMN "recorte_centro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN "gestao" TEXT;

CREATE TABLE "usuario_centros" (
    "usuario_id" TEXT NOT NULL,
    "centro_custo_id" TEXT NOT NULL,

    PRIMARY KEY ("usuario_id", "centro_custo_id"),
    CONSTRAINT "usuario_centros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "usuario_centros_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- O perfil Coordenador passa a recortar por centro de custo.
UPDATE "perfis" SET "recorte_centro" = true WHERE "nome" = 'Coordenador';
