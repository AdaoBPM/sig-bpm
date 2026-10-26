-- Os Resultados por Linha (26/10/2026, pedido do Adão; Apuração dos Resultados): a DRE de cada linha de produto e de obra,
-- da receita à Margem de Contribuição, a partir da DRE apurada de cada unidade, com a Alocação nas Linhas. O processo entra
-- na matriz dos perfis (o Administrador alcança tudo pelo código; os demais perfis, só depois de liberados na tela Perfis).
ALTER TYPE "RecursoSistema" ADD VALUE IF NOT EXISTS 'RESULTADOS_POR_LINHA';
