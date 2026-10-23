-- Os campos Json passam de JSONB a JSON (23/10/2026, Fase 1 da migração para o PostgreSQL): o JSONB reordena as chaves
-- dos objetos (as mais curtas primeiro), e a tela Auditoria (o antes e o depois de cada registro) e a conferência de
-- alterações dos Relatórios Executivos dependem da ordem gravada, como no SQLite. O JSON guarda o texto como veio.
-- Nenhuma consulta filtra dentro desses campos (sem path/array_contains), então nada se perde com o JSON.
-- Na virada, a cópia do SQLite (migrar-sqlite-para-postgres.mjs) deve gravar o texto como está, sem ::jsonb.

-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "dados_antes" SET DATA TYPE JSON,
ALTER COLUMN "dados_depois" SET DATA TYPE JSON,
ALTER COLUMN "metadados" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "cenarios" ALTER COLUMN "variacoes_maximas" SET DATA TYPE JSON,
ALTER COLUMN "indices_reajuste" SET DATA TYPE JSON,
ALTER COLUMN "indices_do_comparativo" SET DATA TYPE JSON,
ALTER COLUMN "realocacoes" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "cenarios_reajustes" ALTER COLUMN "contas" SET DATA TYPE JSON,
ALTER COLUMN "meses" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "competencias" ALTER COLUMN "entradas_apuradas" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "conferencias_planilha" ALTER COLUMN "valores" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "importacoes" ALTER COLUMN "relatorio_erros" SET DATA TYPE JSON,
ALTER COLUMN "resumo" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "relatorios_executivos_abas" ALTER COLUMN "blocos" SET DATA TYPE JSON;

-- AlterTable
ALTER TABLE "resultados_apurados" ALTER COLUMN "composicao" SET DATA TYPE JSON;
