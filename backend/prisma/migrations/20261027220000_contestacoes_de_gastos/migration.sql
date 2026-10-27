-- As Contestações de Gastos (27/10/2026, pedido do Adão): no balancete de uma conta (o modal dos movimentos), o usuário
-- contesta um item, sugerindo outro centro de custo e/ou outra conta; o responsável pelo centro (os Coordenadores dele;
-- sem eles, os Gestores do departamento) acata ou recusa; a Controladoria valida — corrige o item no balancete da
-- competência aberta (a classificação aplica o centro e a conta novos, guardando os do balancete) ou, com a competência
-- fechada, pelos lançamentos manuais da aba Contestações de uma competência aberta. O grupo Contestações de Gastos entra
-- na matriz dos perfis (o Administrador alcança tudo pelo código; os demais, depois de liberados na tela Perfis).
-- CreateEnum
CREATE TYPE "SituacaoContestacao" AS ENUM ('PENDENTE', 'ACATADA', 'RECUSADA', 'VALIDADA');

-- CreateEnum
CREATE TYPE "FormaValidacaoContestacao" AS ENUM ('NO_BALANCETE', 'LANCAMENTO_MANUAL');

-- AlterEnum
ALTER TYPE "RecursoSistema" ADD VALUE IF NOT EXISTS 'CONTESTACOES_GASTOS';

-- AlterTable
ALTER TABLE "lancamentos_contabeis" ADD COLUMN     "contestacao_id" TEXT;

-- AlterTable
ALTER TABLE "lancamentos_manuais" ADD COLUMN     "contestacao_id" TEXT;

-- CreateTable
CREATE TABLE "contestacoes" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "lancamento_contabil_id" TEXT,
    "filial" INTEGER NOT NULL,
    "codigo_centro_custo" TEXT,
    "nome_centro_custo" TEXT,
    "conta_balancete_id" TEXT NOT NULL,
    "emissao" TIMESTAMP(3),
    "cli_forn" TEXT,
    "historico" TEXT,
    "valor" DECIMAL(65,30) NOT NULL,
    "centro_antes_id" TEXT,
    "conta_antes_id" TEXT NOT NULL,
    "centro_novo_id" TEXT,
    "conta_nova_id" TEXT,
    "motivo" TEXT,
    "situacao" "SituacaoContestacao" NOT NULL DEFAULT 'PENDENTE',
    "solicitante_id" TEXT NOT NULL,
    "solicitada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondida_por_id" TEXT,
    "respondida_em" TIMESTAMP(3),
    "justificativa" TEXT,
    "justificada_por_id" TEXT,
    "justificada_em" TIMESTAMP(3),
    "validada_por_id" TEXT,
    "validada_em" TIMESTAMP(3),
    "forma_validacao" "FormaValidacaoContestacao",
    "atualizada_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contestacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contestacoes_numero_key" ON "contestacoes"("numero");

-- CreateIndex
CREATE INDEX "contestacoes_situacao_idx" ON "contestacoes"("situacao");

-- CreateIndex
CREATE INDEX "contestacoes_competencia_id_idx" ON "contestacoes"("competencia_id");

-- CreateIndex
CREATE INDEX "contestacoes_lancamento_contabil_id_idx" ON "contestacoes"("lancamento_contabil_id");

-- CreateIndex
CREATE INDEX "contestacoes_solicitante_id_idx" ON "contestacoes"("solicitante_id");

-- CreateIndex
CREATE INDEX "lancamentos_manuais_contestacao_id_idx" ON "lancamentos_manuais"("contestacao_id");

-- AddForeignKey
ALTER TABLE "lancamentos_manuais" ADD CONSTRAINT "lancamentos_manuais_contestacao_id_fkey" FOREIGN KEY ("contestacao_id") REFERENCES "contestacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_lancamento_contabil_id_fkey" FOREIGN KEY ("lancamento_contabil_id") REFERENCES "lancamentos_contabeis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_conta_balancete_id_fkey" FOREIGN KEY ("conta_balancete_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_centro_antes_id_fkey" FOREIGN KEY ("centro_antes_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_conta_antes_id_fkey" FOREIGN KEY ("conta_antes_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_centro_novo_id_fkey" FOREIGN KEY ("centro_novo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_conta_nova_id_fkey" FOREIGN KEY ("conta_nova_id") REFERENCES "contas_resultado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes" ADD CONSTRAINT "contestacoes_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Os Lançamentos do Fechamento Mensal ganham as abas Controladoria (os lançamentos de hoje) e Contestações (os vindos das
-- contestações): quem tem a tela recebe as duas abas, com a mesma ação.
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'lancamentos_manuais.controladoria', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'lancamentos_manuais' ON CONFLICT DO NOTHING;
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'lancamentos_manuais.contestacoes', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'lancamentos_manuais' ON CONFLICT DO NOTHING;
