-- Totais e Prévias no Fechamento Mensal (27/10/2026): as telas Indicadores e Rateios viram as abas da tela Totais; Receita
-- e Estoque, as da tela Prévias. Cada permissão de uma tela antiga vira a da aba correspondente e a da tela que a abriga
-- (a aba só vale com a tela lida), com a mesma ação; as chaves antigas saem. A tela DRE passa a se chamar Resultados, com
-- a mesma chave (dre).
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT DISTINCT "perfil_id", 'totais', "acao" FROM "perfil_permissoes_telas" WHERE "chave" IN ('indicadores_mes', 'rateios') ON CONFLICT DO NOTHING;
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'totais.indicadores', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'indicadores_mes' ON CONFLICT DO NOTHING;
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'totais.rateios', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'rateios' ON CONFLICT DO NOTHING;
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT DISTINCT "perfil_id", 'previas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" IN ('receita', 'estoque') ON CONFLICT DO NOTHING;
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'previas.receita', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'receita' ON CONFLICT DO NOTHING;
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'previas.estoque', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'estoque' ON CONFLICT DO NOTHING;
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('indicadores_mes', 'rateios', 'receita', 'estoque');
