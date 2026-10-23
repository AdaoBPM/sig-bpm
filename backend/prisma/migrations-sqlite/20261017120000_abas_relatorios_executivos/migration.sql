-- As abas dos Relatórios Executivos (17/10/2026): Fatos Relevantes, Demonstrativo de Resultados e as performances
-- Comercial, da Produção, de Serviços e Administrativa, no lugar dos sete departamentos. A coluna continua
-- "departamento" (o tipo, AbaRelatorioExecutivo, é TEXT no SQLite: sem mudança na estrutura). Nos relatórios já
-- criados, saem as abas de Logística, Técnico e Extra-Operacional e entram as de Fatos e Resultados, vazias.
DELETE FROM "relatorios_executivos_abas" WHERE "departamento" IN ('LOGISTICA', 'TECNICO', 'EXTRA_OPERACIONAL');

INSERT INTO "relatorios_executivos_abas" ("relatorio_id", "departamento", "blocos", "situacao", "atualizado_em")
SELECT "id", 'FATOS', '[]', 'EM_ELABORACAO', strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now') FROM "relatorios_executivos";

INSERT INTO "relatorios_executivos_abas" ("relatorio_id", "departamento", "blocos", "situacao", "atualizado_em")
SELECT "id", 'RESULTADOS', '[]', 'EM_ELABORACAO', strftime('%Y-%m-%dT%H:%M:%f+00:00', 'now') FROM "relatorios_executivos";
