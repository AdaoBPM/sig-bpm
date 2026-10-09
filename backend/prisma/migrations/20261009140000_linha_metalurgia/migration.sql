-- A linha da metalurgia (coluna LINHA incluída na Produção Mensal em 09/10/2026).
-- Só acrescenta a coluna (sem recriar a tabela).
ALTER TABLE "producoes_metalurgia" ADD COLUMN "linha_id" TEXT REFERENCES "linhas" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Os registros já importados ganham a linha da coluna LINHA da planilha, pela finalidade.
UPDATE "producoes_metalurgia" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA')
  WHERE "finalidade" IN ('INSERTO METÁLICO', 'MANUTENÇÃO: MATRIZ', 'INVESTIMENTO: MATRIZ');
UPDATE "producoes_metalurgia" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTACAS')
  WHERE "finalidade" = 'ANEL E LUVA';
UPDATE "producoes_metalurgia" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ALVEOLARES')
  WHERE "finalidade" IN ('MANUTENÇÃO: FILIAL', 'INVESTIMENTO: FILIAL');
UPDATE "producoes_metalurgia" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'MONTAGEM')
  WHERE "finalidade" IN ('FERRAGEM', 'MANUTENÇÃO: OBRAS', 'INVESTIMENTO: OBRAS');
UPDATE "producoes_metalurgia" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'METÁLICA')
  WHERE "finalidade" = 'ESTRUTURA METÁLICA';

-- A armadura ganha a linha da coluna Linha da Produção (Lista Arm.), pela categoria antiga.
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ESTRUTURA') WHERE "linha_id" IS NULL AND "categoria" = 'Matriz (kg)';
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'PRODUTO' AND "codigo" = 'ALVEOLARES') WHERE "linha_id" IS NULL AND "categoria" = 'Filial (kg)';
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'MONTAGEM') WHERE "linha_id" IS NULL AND "categoria" = 'Ferragem (kg)';
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'FUNDAÇÃO') WHERE "linha_id" IS NULL AND "categoria" = 'Fundação (kg)';
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'CAPEAMENTO') WHERE "linha_id" IS NULL AND "categoria" = 'Capeam. (kg)';
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'METÁLICA') WHERE "linha_id" IS NULL AND "categoria" = 'Metálica (kg)';
UPDATE "producoes_armadura" SET "linha_id" = (SELECT "id" FROM "linhas" WHERE "tipo" = 'OBRA' AND "codigo" = 'TURN-KEY') WHERE "linha_id" IS NULL AND "categoria" = 'Turn Key (kg)';
