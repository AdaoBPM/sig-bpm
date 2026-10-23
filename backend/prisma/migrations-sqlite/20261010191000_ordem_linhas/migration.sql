-- A ordem das linhas como no pedido do cadastro Linhas (10/10/2026): Estrutura, Metalúrgica, Alveolares, Estacas,
-- Montagem, Fundação, Capeamento, Metálica, Telhamento, Turn-Key; depois Vedação e Outros (que as medições usam).
UPDATE "linhas" SET "ordem" = 1 WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA';
UPDATE "linhas" SET "ordem" = 2 WHERE "tipo" = 'PRODUTO' AND "codigo" = 'METALÚRGICA';
UPDATE "linhas" SET "ordem" = 3 WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ALVEOLARES';
UPDATE "linhas" SET "ordem" = 4 WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTACAS';
UPDATE "linhas" SET "ordem" = 5 WHERE "tipo" = 'OBRA' AND "codigo" = 'MONTAGEM';
UPDATE "linhas" SET "ordem" = 6 WHERE "tipo" = 'OBRA' AND "codigo" = 'FUNDAÇÃO';
UPDATE "linhas" SET "ordem" = 7 WHERE "tipo" = 'OBRA' AND "codigo" = 'CAPEAMENTO';
UPDATE "linhas" SET "ordem" = 8 WHERE "tipo" = 'OBRA' AND "codigo" = 'METÁLICA';
UPDATE "linhas" SET "ordem" = 9 WHERE "tipo" = 'OBRA' AND "codigo" = 'TELHAMENTO';
UPDATE "linhas" SET "ordem" = 10 WHERE "tipo" = 'OBRA' AND "codigo" = 'TURN-KEY';
UPDATE "linhas" SET "ordem" = 11 WHERE "tipo" = 'OBRA' AND "codigo" = 'VEDAÇÃO';
UPDATE "linhas" SET "ordem" = 12 WHERE "tipo" = 'OBRA' AND "codigo" = 'OUTROS';
