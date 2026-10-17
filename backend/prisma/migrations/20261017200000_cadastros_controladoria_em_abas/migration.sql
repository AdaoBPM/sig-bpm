-- Os Cadastros da Controladoria em três telas com abas (17/10/2026): Contábil (Unidades, Centros de Custo, Contas de
-- Resultado), Controladoria (Linhas, Estrutura da DRE, Regras de Rateio) e Analítico (Estrutura dos Indicadores). Cada
-- permissão de um cadastro vira a da aba correspondente e a da tela que a abriga (a aba só vale com a tela lida), com a
-- mesma ação; as chaves antigas saem.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contabil.unidades', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_unidades';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contabil', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_unidades';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contabil.centros_custo', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_centros_custo';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contabil', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_centros_custo';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contabil.contas_resultado', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_contas_resultado';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contabil', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_contas_resultado';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_controladoria.linhas', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_linhas';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_controladoria', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_linhas';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_controladoria.estrutura_dre', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_estrutura_dre';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_controladoria', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_estrutura_dre';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_controladoria.regras_rateio', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_regras_rateio';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_controladoria', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_regras_rateio';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_analitico.estrutura_indicadores', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_estrutura_indicadores';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_analitico', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cadastro_estrutura_indicadores';
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('cadastro_unidades', 'cadastro_centros_custo', 'cadastro_contas_resultado', 'cadastro_linhas', 'cadastro_estrutura_dre', 'cadastro_regras_rateio', 'cadastro_estrutura_indicadores');
