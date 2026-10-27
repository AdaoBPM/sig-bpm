-- A aba Rateios das Linhas (antes Rateios por Obras) sai da tela Resultados dos Resultados Empresariais (27/10/2026, pedido
-- do Adão): o código fica para o processo Resultados por Obra, que terá a permissão dele. A chave da aba sai do catálogo dos
-- perfis, e as permissões gravadas dela saem também (com elas, a tela Perfis recusaria gravar o perfil: aba inválida).
DELETE FROM "perfil_permissoes_telas" WHERE "chave" = 'relatorio_resultados.rateios_obras';
