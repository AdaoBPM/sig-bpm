-- A competência automática dos Painéis de Bordo (03/11/2026, pedido do Adão): o painel marcado mostra sempre a última
-- competência fechada; nele, a Comparação Padrão fica pela marcação (acompanha o cenário que a tiver). Os painéis de antes
-- ficam com a competência fixa.

-- AlterTable
ALTER TABLE "paineis_de_bordo" ADD COLUMN     "comparacao_padrao" "MarcacaoCenario",
ADD COLUMN     "competencia_automatica" BOOLEAN NOT NULL DEFAULT false;
