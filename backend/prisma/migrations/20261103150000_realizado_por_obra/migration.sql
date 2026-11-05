-- O Realizado por Obra e os Créditos de Impostos (03/11/2026, pedido do Adão):
-- - a tela Impostos do Fechamento Mensal (Créditos de Impostos): os percentuais de cada conta de Matérias Primas e de Gastos
--   Gerais Variáveis da Produção no mês (os Impostos Creditáveis e os Já Creditados; os à Creditar são a diferença);
-- - a etapa Linhas da apuração passa a gravar também o valor de cada obra em cada linha e item (o direto e a parte do rateio
--   da linha), congelado com a competência; as competências fechadas antes disso ficam sem as obras até alguém gravá-las na
--   etapa Linhas do mês;
-- - o processo Realizado por Obra (antes Resultados por Obra, em desenvolvimento): o grupo do menu entra na matriz dos perfis,
--   e cada usuário guarda a obra e a versão vendida escolhidas.

-- AlterEnum
ALTER TYPE "RecursoSistema" ADD VALUE 'REALIZADO_POR_OBRA';

-- CreateTable
CREATE TABLE "resultados_obras" (
    "id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "unidade" INTEGER NOT NULL,
    "linha_id" TEXT,
    "obra_id" TEXT,
    "linha_dre_id" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "direto" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "resultados_obras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creditos_impostos" (
    "competencia_id" TEXT NOT NULL,
    "linha_dre_id" TEXT NOT NULL,
    "creditavel" DECIMAL(65,30) NOT NULL,
    "ja_creditado" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "creditos_impostos_pkey" PRIMARY KEY ("competencia_id","linha_dre_id")
);

-- CreateTable
CREATE TABLE "realizado_obra_configuracoes" (
    "usuario_id" TEXT NOT NULL,
    "obra_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realizado_obra_configuracoes_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateIndex
CREATE INDEX "resultados_obras_obra_id_competencia_id_idx" ON "resultados_obras"("obra_id", "competencia_id");

-- CreateIndex
CREATE INDEX "resultados_obras_competencia_id_idx" ON "resultados_obras"("competencia_id");

-- AddForeignKey
ALTER TABLE "resultados_obras" ADD CONSTRAINT "resultados_obras_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_obras" ADD CONSTRAINT "resultados_obras_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "linhas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_obras" ADD CONSTRAINT "resultados_obras_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_obras" ADD CONSTRAINT "resultados_obras_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_impostos" ADD CONSTRAINT "creditos_impostos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creditos_impostos" ADD CONSTRAINT "creditos_impostos_linha_dre_id_fkey" FOREIGN KEY ("linha_dre_id") REFERENCES "linhas_dre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realizado_obra_configuracoes" ADD CONSTRAINT "realizado_obra_configuracoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realizado_obra_configuracoes" ADD CONSTRAINT "realizado_obra_configuracoes_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A tela Impostos nos perfis: a leitura de quem lê a etapa Linhas do mês.
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'impostos_mes', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'linhas_mes' AND "acao" = 'LER' ON CONFLICT DO NOTHING;

-- As telas do Realizado por Obra nos perfis: as permissões (Ler e Editar) que cada perfil tem em Resultados Empresariais ›
-- Resultados.
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT p."perfil_id", t."chave", p."acao"
FROM "perfil_permissoes_telas" p
CROSS JOIN (VALUES ('realizado_obra_configuracoes'), ('realizado_obra_configuracoes.geral'), ('realizado_obra_configuracoes.almoxarifado'), ('realizado_obra_resultados'), ('realizado_obra_painel')) AS t("chave")
WHERE p."chave" = 'relatorio_resultados'
ON CONFLICT DO NOTHING;
