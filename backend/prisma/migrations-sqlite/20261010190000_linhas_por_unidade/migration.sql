-- Cadastro Linhas (10/10/2026): cada linha ligada a uma unidade. Só acrescenta a coluna (sem recriar a tabela).
ALTER TABLE "linhas" ADD COLUMN "unidade_negocio_id" TEXT REFERENCES "unidades_negocio" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- As unidades das linhas de hoje, como as Listas já gravam: Estrutura e Metalúrgica na Matriz, Alveolares e Estacas
-- na Filial, as linhas de obra em Serviços. As de faturamento ficam sem unidade.
UPDATE "linhas" SET "unidade_negocio_id" = (SELECT "id" FROM "unidades_negocio" WHERE "codigo" = 1) WHERE "tipo" = 'PRODUTO' AND "codigo" IN ('ESTRUTURA', 'METALÚRGICA');
UPDATE "linhas" SET "unidade_negocio_id" = (SELECT "id" FROM "unidades_negocio" WHERE "codigo" = 2) WHERE "tipo" = 'PRODUTO' AND "codigo" IN ('ALVEOLARES', 'ESTACAS');
UPDATE "linhas" SET "unidade_negocio_id" = (SELECT "id" FROM "unidades_negocio" WHERE "codigo" = 3) WHERE "tipo" = 'OBRA';

-- O nome como o usuário escreveu no pedido.
UPDATE "linhas" SET "nome" = 'Turn-Key' WHERE "tipo" = 'OBRA' AND "codigo" = 'TURN-KEY';
