-- O Painel de Bordo sai do Realizado por Obra (03/11/2026, pedido do Adão): volta quando os Resultados Vendidos estiverem
-- prontos e o SIG buscar as informações direto do RM. A chave da tela sai do catálogo dos perfis, e as permissões gravadas
-- dela saem também (com elas, a tela Perfis recusaria gravar o perfil: tela inválida).
DELETE FROM "perfil_permissoes_telas" WHERE "chave" = 'realizado_obra_painel';
