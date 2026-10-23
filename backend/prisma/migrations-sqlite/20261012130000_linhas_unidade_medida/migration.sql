-- A unidade de medida das linhas (12/10/2026), para os Cenários Analíticos.
ALTER TABLE "linhas" ADD COLUMN "unidade_medida" TEXT;

UPDATE "linhas" SET "unidade_medida" = CASE "codigo"
  WHEN 'ESTRUTURA' THEN 'm³'
  WHEN 'METALÚRGICA' THEN 'kg'
  WHEN 'ALVEOLARES' THEN 'm³ e pistas'
  WHEN 'ESTACAS' THEN 'm³ e pistas'
  WHEN 'MONTAGEM' THEN 'm³'
  WHEN 'VEDAÇÃO' THEN 'm'
  WHEN 'FUNDAÇÃO' THEN 'm³'
  WHEN 'CAPEAMENTO' THEN 'm²'
  WHEN 'METÁLICA' THEN 'kg'
  WHEN 'TELHAMENTO' THEN 'm²'
  WHEN 'TURN-KEY' THEN 'dia'
  WHEN 'OUTROS' THEN '%'
END
WHERE "tipo" IN ('PRODUTO', 'OBRA');
