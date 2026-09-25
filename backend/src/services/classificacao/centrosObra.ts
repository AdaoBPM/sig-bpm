/**
 * Centros de custo de obra. Não estão no cadastro — são um por obra, criados
 * no RM a cada contrato —, e a planilha os trata à parte com
 * LEFT(COD_CUSTO, 4) = "1.98" ou "1.99": o lado do centro fica sem parâmetro e
 * a classificação segue só a conta.
 */
const PREFIXOS_OBRA = ["1.98", "1.99"];

export function ehCentroDeObra(codigo: string): boolean {
  return PREFIXOS_OBRA.some((p) => codigo === p || codigo.startsWith(`${p}.`));
}
