/**
 * A chave com que as telas e as importações acham uma linha do cadastro Linhas (11/10/2026: pelo Nome da linha, e
 * não mais pelo Código): o nome em maiúsculas, com hífen no lugar dos espaços. Vale para os dois lados — o Nome no
 * cadastro ("Turn-Key", "Fundação") e o texto das planilhas ("TURN KEY", "FUNDAÇÃO") —, e dá, para as linhas de hoje,
 * exatamente o código que o cadastro gravava (ESTRUTURA, FUNDAÇÃO, TURN-KEY…), de modo que nada muda nos valores.
 *
 * Renomear uma linha muda a chave: por isso o Nome de uma linha com movimentos não se edita (bloqueio do cadastro).
 */
export function chaveDaLinha(texto: string | number | boolean | null | undefined): string {
  return texto === null || texto === undefined ? "" : String(texto).trim().toUpperCase().replace(/\s*-\s*|\s+/g, "-");
}
