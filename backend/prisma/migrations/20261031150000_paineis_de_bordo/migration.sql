-- Os Painéis de Bordo (31/10/2026, Análises Gerenciais; pedido do Adão: feitos a partir dos Relatórios Executivos): cada
-- painel tem o nome, a visualização (Privado ou Público, como nos cenários), a competência (vários painéis por competência)
-- e uma tela só, Painel de Bordo, com as páginas e os blocos delas.

-- CreateEnum
CREATE TYPE "VisualizacaoPainel" AS ENUM ('PRIVADO', 'PUBLICO');

-- CreateTable
CREATE TABLE "paineis_de_bordo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "visualizacao" "VisualizacaoPainel" NOT NULL DEFAULT 'PRIVADO',
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "paginas" JSON NOT NULL,
    "paginas_por" TEXT,
    "paginas_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cenario_comparado_id" TEXT,
    "comparacao_prova" "MarcacaoCenario"[] DEFAULT ARRAY[]::"MarcacaoCenario"[],
    "criado_por_id" TEXT NOT NULL,
    "criado_por_nome" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paineis_de_bordo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paineis_de_bordo_ano_mes_idx" ON "paineis_de_bordo"("ano", "mes");

-- A tela Painéis de Bordo nos perfis: as mesmas permissões (Ler e Editar) que cada perfil tem nos Relatórios Executivos.
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'paineis_de_bordo', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'relatorios_executivos' ON CONFLICT DO NOTHING;
