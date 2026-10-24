-- O Frete e Descarga dos Serviços Complementares (24/10/2026, pedido do Adão): uma linha nova nos Gastos Gerais
-- Variáveis dos Complementares (CSC), só na aba Serviços. Como as demais linhas da CSC, ela soma os lançamentos do
-- rateio COMPLEMENTAR, e o % é sobre a Receita Líquida Complementar. O Frete e Descarga do DVV continua só na Matriz e
-- na Filial. A conta 50051 (Fretes das Fundações), que nenhuma aba lia (DVV com o rateio OBRAS), passa a ter onde
-- ficar: o departamento CSC, esta linha e o rateio COMPLEMENTAR (o modal da conta oferece a combinação).
-- Nos cenários, a linha entra pela Estrutura da DRE: nas premissas das linhas complementares de Serviços e na edição
-- da visão Serviços. Idempotente: não faz nada se a linha já existe.

-- Abre a posição logo depois dos Equipamentos Locados (o último item dos Gastos Gerais Variáveis da CSC).
UPDATE "linhas_dre"
SET "ordem" = "ordem" + 1
WHERE "ordem" > (SELECT "ordem" FROM "linhas_dre" WHERE "codigo" = 'CSC.GGV.EQUIPAMENTOS_LOCADOS')
  AND NOT EXISTS (SELECT 1 FROM "linhas_dre" WHERE "codigo" = 'CSC.GGV.FRETE_E_DESCARGA');

INSERT INTO "linhas_dre" ("id", "codigo", "ordem", "grupo", "grupo_sigla", "atribuicao", "atribuicao_sigla", "descricao", "tipo", "expressao", "definicao", "ativo", "criado_em", "atualizado_em")
SELECT gen_random_uuid()::text, 'CSC.GGV.FRETE_E_DESCARGA', l."ordem" + 1, l."grupo", l."grupo_sigla", l."atribuicao", l."atribuicao_sigla", 'Frete e Descarga', 'ITEM', NULL,
       'Notas fiscais de frete dos serviços complementares', true, now(), now()
FROM "linhas_dre" l
WHERE l."codigo" = 'CSC.GGV.EQUIPAMENTOS_LOCADOS'
  AND NOT EXISTS (SELECT 1 FROM "linhas_dre" WHERE "codigo" = 'CSC.GGV.FRETE_E_DESCARGA');

-- Só na aba Serviços (unidade 3).
INSERT INTO "linhas_dre_unidades" ("linha_dre_id", "unidade_negocio_id")
SELECT l."id", u."id"
FROM "linhas_dre" l, "unidades_negocio" u
WHERE l."codigo" = 'CSC.GGV.FRETE_E_DESCARGA' AND u."codigo" = 3
ON CONFLICT DO NOTHING;

-- O subtotal dos Gastos Gerais Variáveis da CSC passa a somar a linha.
UPDATE "linhas_dre"
SET "expressao" = "expressao" || ' + CSC.GGV.FRETE_E_DESCARGA', "atualizado_em" = now()
WHERE "codigo" = 'CSC.GGV.GASTOS_GERAIS_VARIAVEIS'
  AND "expressao" NOT LIKE '%CSC.GGV.FRETE_E_DESCARGA%';
