/**
 * A palavra no singular ou no plural pela quantidade (14/10/2026; no lugar dos "lançamento(s)", "valor(es)"…):
 * plural(1, "linha", "linhas") → "linha"; plural(3, "linha", "linhas") → "linhas". Só 1 (e -1) é singular; 0 é plural.
 */
export function plural(n: number, singular: string, plural: string) {
  return Math.abs(n) === 1 ? singular : plural;
}
