-- Relatórios Executivos (22/10/2026): o cenário de comparação escolhido na aba Configurações (sem ele, o Orçamento Empresarial).
ALTER TABLE "relatorios_executivos" ADD COLUMN "cenario_comparado_id" TEXT;
