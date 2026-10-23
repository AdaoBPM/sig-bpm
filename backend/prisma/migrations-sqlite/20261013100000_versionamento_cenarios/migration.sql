-- O versionamento dos cenários (13/10/2026): a versão (VER00, VER01…), a família, a origem da revisão e a versão salva.
ALTER TABLE "cenarios" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cenarios" ADD COLUMN "familia_id" TEXT;
ALTER TABLE "cenarios" ADD COLUMN "revisao_de_id" TEXT;
ALTER TABLE "cenarios" ADD COLUMN "versao_salva_em" DATETIME;
ALTER TABLE "cenarios" ADD COLUMN "versao_salva_por" TEXT;
