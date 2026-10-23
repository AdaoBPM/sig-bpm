-- A aba Sem Centros de Custo da tela Resultados (Resultados Realizados, 14/10/2026): quem lê ou edita a aba Centros de
-- Custo ganha o mesmo nesta aba (só dados).
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "perfil_id", 'relatorio_resultados.sem_centros', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'relatorio_resultados.centros';
