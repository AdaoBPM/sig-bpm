-- A tela Configurações sai do Realizado por Obra (03/11/2026, pedido do Adão): a venda se escolhe na lista Venda dos
-- Resultados e do Painel de Bordo, e a aba Almoxarifado vai para Resultados Empresariais › Resultados. As chaves da tela e
-- das abas dela saem do catálogo dos perfis, e as permissões gravadas delas saem também (com elas, a tela Perfis recusaria
-- gravar o perfil: aba inválida).
DELETE FROM "perfil_permissoes_telas" WHERE "chave" IN ('realizado_obra_configuracoes', 'realizado_obra_configuracoes.geral', 'realizado_obra_configuracoes.almoxarifado');

-- A aba Almoxarifado nos perfis: as permissões (Ler e Editar) que cada perfil tem em Resultados Empresariais › Resultados.
INSERT INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao")
SELECT "perfil_id", 'relatorio_resultados.almoxarifado', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'relatorio_resultados'
ON CONFLICT DO NOTHING;
