/** Artigos, preposições, conjunções e pronomes que ficam em minúscula no meio de um nome. */
const MINUSCULAS = new Set([
  "a", "o", "as", "os", "e", "ou", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "num", "numa",
  "com", "sem", "sob", "para", "por", "pelo", "pela", "pelos", "pelas", "ao", "aos", "à", "às", "que", "se", "lhe",
]);

/**
 * "Centro fora do cadastro" → "Centro Fora do Cadastro": iniciais maiúsculas,
 * como nos nomes das telas, das abas, dos títulos e dos rótulos das colunas,
 * menos nos artigos, preposições, conjunções e pronomes do meio. O resto da
 * palavra fica como está (siglas como DRE não mudam), e a palavra que começa
 * por parêntese também ("Peso (kg)").
 */
export function iniciaisMaiusculas(texto: string) {
  return texto
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}
