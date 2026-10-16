-- O Nome de Referência dos investimentos dos cenários (15/10/2026): digitado, único no cenário. Os que já existem
-- recebem a descrição; quando ela se repete no cenário, com " (2)", " (3)"… na ordem da lista.
ALTER TABLE "cenarios_investimentos" ADD COLUMN "nome_referencia" TEXT NOT NULL DEFAULT '';

UPDATE "cenarios_investimentos"
SET "nome_referencia" = "descricao" || CASE
  WHEN (
    SELECT COUNT(*) FROM "cenarios_investimentos" AS o
    WHERE o."cenario_id" = "cenarios_investimentos"."cenario_id"
      AND o."descricao" = "cenarios_investimentos"."descricao"
      AND (o."ordem" < "cenarios_investimentos"."ordem" OR (o."ordem" = "cenarios_investimentos"."ordem" AND o."id" < "cenarios_investimentos"."id"))
  ) = 0 THEN ''
  ELSE ' (' || CAST((
    SELECT COUNT(*) FROM "cenarios_investimentos" AS o
    WHERE o."cenario_id" = "cenarios_investimentos"."cenario_id"
      AND o."descricao" = "cenarios_investimentos"."descricao"
      AND (o."ordem" < "cenarios_investimentos"."ordem" OR (o."ordem" = "cenarios_investimentos"."ordem" AND o."id" < "cenarios_investimentos"."id"))
  ) + 1 AS TEXT) || ')'
END;

-- CreateIndex
CREATE UNIQUE INDEX "cenarios_investimentos_cenario_id_nome_referencia_key" ON "cenarios_investimentos"("cenario_id", "nome_referencia");
