-- AlterTable
ALTER TABLE "acompanhamentos" ADD COLUMN "etapa" TEXT;
ALTER TABLE "acompanhamentos" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "acompanhamentos" ADD COLUMN "observacao" TEXT;

-- AlterTable
ALTER TABLE "expedicoes" ADD COLUMN "codigo_controle" TEXT;
ALTER TABLE "expedicoes" ADD COLUMN "data" DATETIME;
ALTER TABLE "expedicoes" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "expedicoes" ADD COLUMN "nome_peca" TEXT;
ALTER TABLE "expedicoes" ADD COLUMN "numero_carga" TEXT;
ALTER TABLE "expedicoes" ADD COLUMN "peso_kg" DECIMAL;
ALTER TABLE "expedicoes" ADD COLUMN "volume_informado" DECIMAL;

-- AlterTable
ALTER TABLE "montagens" ADD COLUMN "data" DATETIME;
ALTER TABLE "montagens" ADD COLUMN "grupo" TEXT;
ALTER TABLE "montagens" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "montagens" ADD COLUMN "quantidade_pecas" DECIMAL;
ALTER TABLE "montagens" ADD COLUMN "secao" TEXT;

-- AlterTable
ALTER TABLE "producoes" ADD COLUMN "codigo_controle" TEXT;
ALTER TABLE "producoes" ADD COLUMN "data" DATETIME;
ALTER TABLE "producoes" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "producoes" ADD COLUMN "nome_peca" TEXT;
ALTER TABLE "producoes" ADD COLUMN "produto" TEXT;

-- AlterTable
ALTER TABLE "producoes_armadura" ADD COLUMN "categoria" TEXT;
ALTER TABLE "producoes_armadura" ADD COLUMN "linha_arquivo" INTEGER;

-- AlterTable
ALTER TABLE "producoes_metalurgia" ADD COLUMN "linha_arquivo" INTEGER;

-- AlterTable
ALTER TABLE "producoes_pista" ADD COLUMN "data" DATETIME;
ALTER TABLE "producoes_pista" ADD COLUMN "linha_arquivo" INTEGER;

-- AlterTable
ALTER TABLE "projetos" ADD COLUMN "codigo_peca" TEXT;
ALTER TABLE "projetos" ADD COLUMN "comprimento" DECIMAL;
ALTER TABLE "projetos" ADD COLUMN "data" DATETIME;
ALTER TABLE "projetos" ADD COLUMN "grupo" TEXT;
ALTER TABLE "projetos" ADD COLUMN "linha_arquivo" INTEGER;
ALTER TABLE "projetos" ADD COLUMN "nome_peca" TEXT;
ALTER TABLE "projetos" ADD COLUMN "peso_kg" DECIMAL;
ALTER TABLE "projetos" ADD COLUMN "produto" TEXT;
ALTER TABLE "projetos" ADD COLUMN "secao" TEXT;

