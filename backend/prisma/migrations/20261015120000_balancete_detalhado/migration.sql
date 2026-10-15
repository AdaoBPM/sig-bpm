-- O balancete detalhado (15/10/2026): o cliente ou fornecedor, a data de emissão e o histórico de cada movimento
-- (colunas CLI_FORN, EMISSAO e HISTORICO do Balancete (Lista) do LISTAS REALIZADO (RESULTADOS)).
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "cli_forn" TEXT;
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "emissao" DATETIME;
ALTER TABLE "lancamentos_contabeis" ADD COLUMN "historico" TEXT;
