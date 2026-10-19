-- Os Indicadores como aba do Painel de Bordo (19/10/2026), em Resultados Empresariais e nos cenários: quem lia a tela
-- Indicadores passa a ler a tela Painel de Bordo e a aba Indicadores dela (nos cenários, as abas Indicadores: Metas,
-- Indicadores de Resultados e Indicadores Manuais), com a mesma ação; as chaves antigas saem.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_painel', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'relatorio_indicadores';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_painel.indicadores', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'relatorio_indicadores';
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('relatorio_indicadores');
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_indicadores';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel.metas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_indicadores.metas';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel.indicadores_resultados', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_indicadores.resultados';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel.manuais', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_indicadores.manuais';
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('cenarios_indicadores', 'cenarios_indicadores.metas', 'cenarios_indicadores.resultados', 'cenarios_indicadores.manuais');
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_indicadores';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.metas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_indicadores.metas';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.indicadores_resultados', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_indicadores.resultados';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.manuais', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_indicadores.manuais';
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('cenarios_analiticos_indicadores', 'cenarios_analiticos_indicadores.metas', 'cenarios_analiticos_indicadores.resultados', 'cenarios_analiticos_indicadores.manuais');
