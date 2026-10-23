-- Os indicadores dos cenários (19/10/2026): no Painel de Bordo fica só a aba Indicadores (a chave metas: todos os
-- indicadores), que recebe quem lia os Indicadores de Resultados (e, nos analíticos, os Indicadores Manuais, que lá se
-- digitam nas Premissas); nos sintéticos, os Indicadores Manuais vão para a tela Configurações, com a mesma ação.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_configuracoes', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_painel.manuais';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_configuracoes.manuais', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_painel.manuais';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel.metas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_painel.indicadores_resultados';
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('cenarios_painel.manuais', 'cenarios_painel.indicadores_resultados');
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.metas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_painel.indicadores_resultados';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.metas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_painel.manuais';
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('cenarios_analiticos_painel.indicadores_resultados', 'cenarios_analiticos_painel.manuais');
