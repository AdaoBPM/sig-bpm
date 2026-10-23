-- A aba Sem Centros de Custo da DRE do mês (Fechamento Mensal, 15/10/2026): quem lê ou edita a aba Centros de Custo da
-- DRE ganha o mesmo nesta aba (só dados).
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "perfil_id", 'dre.sem_centros', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'dre.centros';
