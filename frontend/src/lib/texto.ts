/** Artigos, preposições e conjunções que ficam em minúscula no meio de um nome. */
const MINUSCULAS = new Set(["a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "com", "para", "por"]);

/**
 * "Centro fora do cadastro" → "Centro Fora do Cadastro": iniciais maiúsculas,
 * como nos nomes das telas, menos nos artigos e preposições do meio. O resto
 * da palavra fica como está (siglas como DRE não mudam).
 */
export function iniciaisMaiusculas(texto: string) {
  return texto
    .split(" ")
    .map((p, i) => (i > 0 && MINUSCULAS.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}
