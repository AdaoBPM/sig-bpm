-- O Frete e Descarga dos Serviços Complementares (24/10/2026, pedido do Adão): a linha Frete e Descarga das Despesas
-- Variáveis de Venda (DVV), que estava só na Matriz e na Filial, passa a aparecer também na aba Serviços. Em Serviços,
-- ela soma só os lançamentos do rateio COMPLEMENTAR (o frete dos complementares, regra em apuracaoUnidades.ts), e o % é
-- sobre a Receita Líquida Complementar. A conta 50051 (Fretes das Fundações), que nenhuma aba lia (DVV com o rateio
-- OBRAS), fica correta com o rateio COMPLEMENTAR. Nos cenários, a linha entra pela Estrutura da DRE: na edição da visão
-- Serviços e nas premissas das linhas complementares de Serviços. Idempotente.

INSERT INTO "linhas_dre_unidades" ("linha_dre_id", "unidade_negocio_id")
SELECT l."id", u."id"
FROM "linhas_dre" l, "unidades_negocio" u
WHERE l."codigo" = 'DVV.GGV.FRETE_E_DESCARGA' AND u."codigo" = 3
ON CONFLICT DO NOTHING;
