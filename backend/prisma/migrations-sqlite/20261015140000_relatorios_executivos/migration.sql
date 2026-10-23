-- Os Relatórios Executivos (15/10/2026, Análises Gerenciais): um relatório por competência fechada, com uma aba por departamento.
-- CreateTable
CREATE TABLE "relatorios_executivos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_por_nome" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "relatorios_executivos_abas" (
    "relatorio_id" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "blocos" JSONB NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'EM_ELABORACAO',
    "atualizado_por" TEXT,
    "atualizado_em" DATETIME NOT NULL,
    "finalizado_por" TEXT,
    "finalizado_em" DATETIME,

    PRIMARY KEY ("relatorio_id", "departamento"),
    CONSTRAINT "relatorios_executivos_abas_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorios_executivos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_executivos_ano_mes_key" ON "relatorios_executivos"("ano", "mes");


-- A tela Relatórios Executivos (só dados): todos os perfis a leem e editam (cada gestor edita as abas do seu recorte);
-- o Administrador tem tudo. Os perfis se ajustam em Controle de Usuários / Perfis.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "id", 'relatorios_executivos', 'LER' FROM "perfis";
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "id", 'relatorios_executivos', 'EDITAR' FROM "perfis";
