-- Os Créditos de Impostos do mês saem da etapa Impostos do Fechamento Mensal e viram a aba Impostos da tela Resultados do
-- mês (04/11/2026, pedido do Adão): a chave deles no catálogo dos perfis muda, e as permissões gravadas vão para a chave nova.
UPDATE "perfil_permissoes_telas" SET "chave" = 'dre.impostos' WHERE "chave" = 'impostos_mes';
