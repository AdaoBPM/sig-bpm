-- A aba Almoxarifado de Resultados Empresariais › Resultados passa a se chamar Impostos (Créditos de Impostos; 03/11/2026,
-- pedido do Adão): a chave dela no catálogo dos perfis muda, e as permissões gravadas vão para a chave nova.
UPDATE "perfil_permissoes_telas" SET "chave" = 'relatorio_resultados.impostos' WHERE "chave" = 'relatorio_resultados.almoxarifado';
