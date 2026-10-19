-- Os Índices de Reajuste dos cenários analíticos (19/10/2026; Configurações / Índices): a lista do cenário e o índice de
-- cada conta no Comparativo, no lugar da variação máxima digitada.
ALTER TABLE "cenarios" ADD COLUMN "indices_reajuste" JSONB;
ALTER TABLE "cenarios" ADD COLUMN "indices_do_comparativo" JSONB;

-- As variações já digitadas nos analíticos viram índices (decisão do usuário): um por valor usado ("Variação de 15,5%"),
-- do maior para o menor, e cada conta fica com o índice do valor dela.
UPDATE "cenarios" SET
  "indices_reajuste" = (
    SELECT json_group_array(json_object('chave', 'i' || d.rn, 'descricao', 'Variação de ' || replace(printf('%g', d.v), '.', ',') || '%', 'observacao', 'Convertido das variações digitadas no Comparativo (19/10/2026).', 'variacao', d.v))
    FROM (SELECT v, row_number() OVER (ORDER BY v DESC) rn FROM (SELECT DISTINCT j.value AS v FROM json_each("cenarios"."variacoes_maximas") j)) d
  ),
  "indices_do_comparativo" = (
    SELECT json_group_object(j.key, 'i' || d.rn)
    FROM json_each("cenarios"."variacoes_maximas") j
    JOIN (SELECT v, row_number() OVER (ORDER BY v DESC) rn FROM (SELECT DISTINCT k.value AS v FROM json_each("cenarios"."variacoes_maximas") k)) d ON d.v = j.value
  )
WHERE "tipo" = 'ANALITICO' AND "variacoes_maximas" IS NOT NULL AND "variacoes_maximas" <> '{}';

-- A aba Índices das Configurações dos analíticos: quem tinha o Comparativo ganha a mesma permissão nela.
INSERT OR IGNORE INTO "perfil_permissoes_telas" ("perfil_id", "chave", "acao") SELECT "perfil_id", 'cenarios_analiticos_configuracoes.indices', "acao" FROM "perfil_permissoes_telas" WHERE "chave" = 'cenarios_analiticos_configuracoes.comparativo';
