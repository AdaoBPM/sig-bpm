-- Faturamentos e obras encerradas só alimentavam a aba Fechamentos (Faturamento),
-- que ficou fora da ferramenta. Saem os lotes importados e as tabelas.
DELETE FROM "importacoes" WHERE "tipo" IN ('FATURAMENTO', 'OBRA_ENCERRADA');

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "faturamentos";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "obras_encerradas";
PRAGMA foreign_keys=on;

