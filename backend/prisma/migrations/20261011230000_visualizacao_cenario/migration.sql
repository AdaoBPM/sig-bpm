-- Visualização do cenário (11/10/2026): particular ou pública, e o usuário que o criou.
ALTER TABLE "cenarios" ADD COLUMN "criado_por_id" TEXT;
ALTER TABLE "cenarios" ADD COLUMN "visualizacao" TEXT NOT NULL DEFAULT 'PUBLICA';

-- Os cenários existentes ficam públicos (como eram); o criador sai do nome gravado.
UPDATE "cenarios" SET "criado_por_id" = (SELECT "id" FROM "usuarios" WHERE "usuarios"."nome" = "cenarios"."criado_por" LIMIT 1);
