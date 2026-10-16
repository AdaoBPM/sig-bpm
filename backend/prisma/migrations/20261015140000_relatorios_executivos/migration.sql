-- Os Relatórios Executivos (15/10/2026, Análises Gerenciais): a tabela dos relatórios mensais dos gestores.
-- CreateTable
CREATE TABLE "relatorios_executivos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "autor_id" TEXT NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "departamentos" JSONB NOT NULL,
    "blocos" JSONB NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'EM_ELABORACAO',
    "finalizado_em" DATETIME,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "relatorios_executivos_ano_mes_idx" ON "relatorios_executivos"("ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_executivos_ano_mes_autor_id_key" ON "relatorios_executivos"("ano", "mes", "autor_id");


-- A tela Relatórios Executivos (só dados): todos os perfis a leem e editam (cada gestor cria a sua apresentação); o
-- Administrador tem tudo. Os perfis se ajustam em Controle de Usuários / Perfis.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "id", 'relatorios_executivos', 'LER' FROM "perfis";
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "id", 'relatorios_executivos', 'EDITAR' FROM "perfis";
