-- Permissões por grupo de telas do menu lateral (11/10/2026): de recurso × Ver/Ler/Editar
-- para grupo × Ler/Editar. Cada grupo novo recebe o maior nível que o perfil tinha nos
-- recursos antigos que as telas dele usavam; Ver sozinho (a tela aparecia sem dados) não
-- vira nada.
WITH niveis AS (
  SELECT perfil_id, recurso, MAX(CASE acao WHEN 'EDITAR' THEN 2 WHEN 'LER' THEN 1 ELSE 0 END) AS n
  FROM perfil_permissoes GROUP BY perfil_id, recurso
),
mapa(antigo, novo) AS (VALUES
  ('CENARIOS', 'CENARIOS_SINTETICOS'),
  ('CENARIOS', 'CENARIOS_ANALITICOS'),
  ('DRE', 'RESULTADOS_REALIZADOS'),
  ('COMPETENCIA', 'FECHAMENTO_MENSAL'),
  ('IMPORTACAO', 'FECHAMENTO_MENSAL'),
  ('LISTAS_OPERACIONAIS', 'FECHAMENTO_MENSAL'),
  ('LANCAMENTOS_MANUAIS', 'FECHAMENTO_MENSAL'),
  ('CLASSIFICACAO', 'FECHAMENTO_MENSAL'),
  ('APURACAO', 'FECHAMENTO_MENSAL'),
  ('DRE', 'FECHAMENTO_MENSAL'),
  ('DIVERGENCIA', 'FECHAMENTO_MENSAL'),
  ('CADASTROS', 'CADASTROS_APURACAO'),
  ('CADASTROS', 'CADASTROS_CONTROLADORIA'),
  ('USUARIOS', 'CONTROLE_USUARIOS'),
  ('AUDITORIA', 'CONTROLE_USUARIOS')
),
novos AS (
  SELECT niveis.perfil_id, mapa.novo AS recurso, MAX(niveis.n) AS n
  FROM niveis JOIN mapa ON mapa.antigo = niveis.recurso
  GROUP BY niveis.perfil_id, mapa.novo
  HAVING MAX(niveis.n) > 0
)
INSERT INTO perfil_permissoes (perfil_id, recurso, acao)
SELECT perfil_id, recurso, 'LER' FROM novos
UNION ALL
SELECT perfil_id, recurso, 'EDITAR' FROM novos WHERE n = 2;

DELETE FROM perfil_permissoes
WHERE acao = 'VER'
   OR recurso NOT IN ('CENARIOS_SINTETICOS', 'CENARIOS_ANALITICOS', 'RESULTADOS_REALIZADOS', 'FECHAMENTO_MENSAL', 'CADASTROS_APURACAO', 'CADASTROS_CONTROLADORIA', 'CONTROLE_USUARIOS');
