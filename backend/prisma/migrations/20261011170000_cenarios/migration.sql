-- Criação de Cenários (11/10/2026): os cenários sintéticos, a DRE e as metas de cada um.
-- CreateTable
CREATE TABLE "cenarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'SINTETICO',
    "descricao" TEXT,
    "marcacao" TEXT,
    "nome_arquivo" TEXT,
    "importado_em" DATETIME,
    "criado_por" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cenarios_resultados" (
    "cenario_id" TEXT NOT NULL,
    "visao" INTEGER NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL NOT NULL,

    PRIMARY KEY ("cenario_id", "visao", "linha_dre_id", "mes"),
    CONSTRAINT "cenarios_resultados_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cenarios_resultados_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cenarios_indicadores" (
    "cenario_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DECIMAL NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'IMPORTADO',

    PRIMARY KEY ("cenario_id", "nome", "mes"),
    CONSTRAINT "cenarios_indicadores_cenario_id_fkey" FOREIGN KEY ("cenario_id") REFERENCES "cenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cenarios_ano_marcacao_key" ON "cenarios"("ano", "marcacao");

-- CreateIndex
CREATE INDEX "cenarios_resultados_linha_dre_id_idx" ON "cenarios_resultados"("linha_dre_id");


-- O recurso Cenários nasce com as permissões que cada perfil tem na DRE (ver, ler, editar).
INSERT INTO "perfil_permissoes" ("perfil_id", "recurso", "acao")
SELECT "perfil_id", 'CENARIOS', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'DRE';
