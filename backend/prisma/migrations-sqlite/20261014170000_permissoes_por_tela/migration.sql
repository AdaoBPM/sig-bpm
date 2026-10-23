-- As permissões por tela e por aba (14/10/2026): a matriz dos perfis passa do grupo do menu para cada tela e cada aba
-- de conteúdo (o catálogo em services/acesso/telas.ts). Cada tela e aba recebe a permissão que o perfil tinha no grupo.
-- CreateTable
CREATE TABLE "perfil_permissoes_telas" (
    "perfil_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "acao" TEXT NOT NULL,

    PRIMARY KEY ("perfil_id", "chave", "acao"),
    CONSTRAINT "perfil_permissoes_telas_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "perfis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- As permissões dos grupos copiadas para as telas e as abas de cada grupo.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_lista', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_configuracoes', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_configuracoes.cenario', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_configuracoes.referencia', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_configuracoes.comparativo', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados.consolidado', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados.matriz', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados.filial', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados.servicos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados.despesas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_resultados.rn', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_indicadores', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_indicadores.metas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_indicadores.resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_indicadores.manuais', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel.resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_painel.performance', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_reajustes', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_reajustes.historico', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_reajustes.justificativas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_SINTETICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_lista', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_configuracoes', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_configuracoes.cenario', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_configuracoes.referencia', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_configuracoes.comparativo', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.matriz', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.filial', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.servicos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.centros', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.rateios', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.investimentos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.extra', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_premissas.manuais', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados.consolidado', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados.matriz', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados.filial', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados.servicos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados.despesas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_resultados.rn', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_indicadores', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_indicadores.metas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_indicadores.resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_indicadores.manuais', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_painel.performance', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_reajustes', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_reajustes.historico', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_reajustes.justificativas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CENARIOS_ANALITICOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.consolidado', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.matriz', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.filial', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.servicos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.despesas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.rn', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.centros', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_resultados.obras', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_indicadores', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_painel', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_painel.resultados', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'relatorio_painel.performance', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'RESULTADOS_REALIZADOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'competencias', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'importacao', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'classificacao', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'lancamentos_manuais', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'listas_operacionais', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'indicadores_mes', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'receita', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'rateios', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'estoque', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.consolidado', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.matriz', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.filial', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.servicos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.despesas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.rn', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.centros', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'dre.obras', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia.consolidado', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia.matriz', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia.filial', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia.servicos', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia.despesas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'conferencia.rn', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'divergencia', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'FECHAMENTO_MENSAL';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_reclassificacoes', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_APURACAO';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_precos_contrato', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_APURACAO';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_tipos_movimento', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_APURACAO';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_tabela_estacas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_APURACAO';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_unidades', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_linhas', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_centros_custo', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_contas_resultado', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_estrutura_indicadores', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_regras_rateio', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cadastro_estrutura_dre', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CADASTROS_CONTROLADORIA';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'usuarios', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CONTROLE_USUARIOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'perfis', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CONTROLE_USUARIOS';
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'auditoria', "acao" FROM "perfil_permissoes" WHERE "recurso" = 'CONTROLE_USUARIOS';

