-- Contestar Anteriores e Posteriores (30/10/2026): uma contestação com vários movimentos (o contestado e os do mesmo
-- fornecedor, conta e centro de custo nas competências anteriores e seguintes), corrigidos cada um por si.

-- AlterTable
ALTER TABLE "contestacoes" ADD COLUMN     "anteriores" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posteriores" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "contestacoes_movimentos" (
    "id" TEXT NOT NULL,
    "contestacao_id" TEXT NOT NULL,
    "competencia_id" TEXT NOT NULL,
    "lancamento_contabil_id" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
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
    "forma_validacao" "FormaValidacaoContestacao",
    "corrigido_em" TIMESTAMP(3),

    CONSTRAINT "contestacoes_movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contestacoes_movimentos_contestacao_id_idx" ON "contestacoes_movimentos"("contestacao_id");

-- CreateIndex
CREATE INDEX "contestacoes_movimentos_competencia_id_idx" ON "contestacoes_movimentos"("competencia_id");

-- CreateIndex
CREATE INDEX "contestacoes_movimentos_lancamento_contabil_id_idx" ON "contestacoes_movimentos"("lancamento_contabil_id");

-- AddForeignKey
ALTER TABLE "contestacoes_movimentos" ADD CONSTRAINT "contestacoes_movimentos_contestacao_id_fkey" FOREIGN KEY ("contestacao_id") REFERENCES "contestacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_movimentos" ADD CONSTRAINT "contestacoes_movimentos_competencia_id_fkey" FOREIGN KEY ("competencia_id") REFERENCES "competencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_movimentos" ADD CONSTRAINT "contestacoes_movimentos_lancamento_contabil_id_fkey" FOREIGN KEY ("lancamento_contabil_id") REFERENCES "lancamentos_contabeis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_movimentos" ADD CONSTRAINT "contestacoes_movimentos_conta_balancete_id_fkey" FOREIGN KEY ("conta_balancete_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_movimentos" ADD CONSTRAINT "contestacoes_movimentos_centro_antes_id_fkey" FOREIGN KEY ("centro_antes_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contestacoes_movimentos" ADD CONSTRAINT "contestacoes_movimentos_conta_antes_id_fkey" FOREIGN KEY ("conta_antes_id") REFERENCES "contas_resultado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- As contestações de antes: o movimento delas vira o principal, com a correção que já tinham.
INSERT INTO "contestacoes_movimentos" ("id", "contestacao_id", "competencia_id", "lancamento_contabil_id", "principal", "filial",
  "codigo_centro_custo", "nome_centro_custo", "conta_balancete_id", "emissao", "cli_forn", "historico", "valor", "centro_antes_id",
  "conta_antes_id", "forma_validacao", "corrigido_em")
SELECT gen_random_uuid()::text, c."id", c."competencia_id", c."lancamento_contabil_id", true, c."filial", c."codigo_centro_custo",
  c."nome_centro_custo", c."conta_balancete_id", c."emissao", c."cli_forn", c."historico", c."valor", c."centro_antes_id",
  c."conta_antes_id", CASE WHEN c."situacao" = 'VALIDADA' THEN c."forma_validacao" END, CASE WHEN c."situacao" = 'VALIDADA' AND c."forma_validacao" IS NOT NULL THEN c."validada_em" END
FROM "contestacoes" c;
