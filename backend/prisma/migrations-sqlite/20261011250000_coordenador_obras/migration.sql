-- Coordenador: a opção de ver os resultados das obras, nas linhas da gestão dele (11/10/2026).
ALTER TABLE "usuarios" ADD COLUMN "ve_obras" BOOLEAN NOT NULL DEFAULT false;
