-- A Comparação PROVA dos Relatórios Executivos (31/10/2026, a aba Configurações): as marcações dos cenários que os objetos
-- PROVA (os cards e as tabelas) comparam, dois ou mais; vazia, todos os cenários marcados.

-- AlterTable
ALTER TABLE "relatorios_executivos" ADD COLUMN "comparacao_prova" "MarcacaoCenario"[] DEFAULT ARRAY[]::"MarcacaoCenario"[];
