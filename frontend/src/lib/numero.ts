/** Só pontos de milhar, como se escreve no Brasil: "1.298", "12.500.000" (não "0.125"). */
const SO_MILHAR = /^-?[1-9]\d{0,2}(\.\d{3})+$/;

/**
 * O número digitado, como texto decimal para o backend ("3832.50"). Aceita o
 * formato brasileiro e o com ponto decimal:
 * - com vírgula, o ponto é de milhar: "3.832,50" → "3832.50";
 * - só com pontos de milhar: "1.298" → "1298";
 * - senão, o ponto é decimal: "1234.56" → "1234.56", "0.05" → "0.05".
 */
export function textoParaDecimal(texto: string): string {
  const t = texto.trim().replace(/\s/g, "");
  if (t.includes(",")) return t.replace(/\./g, "").replace(",", ".");
  if (SO_MILHAR.test(t)) return t.replace(/\./g, "");
  return t;
}

/** O número digitado, ou null se não for número. */
export function lerNumero(texto: string): number | null {
  const t = textoParaDecimal(texto);
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
