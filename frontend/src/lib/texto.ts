/** Artigos, preposições, conjunções e pronomes que ficam em minúscula no meio de um nome. */
const MINUSCULAS = new Set([
  "a", "o", "as", "os", "e", "ou", "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos", "num", "numa",
  "com", "sem", "sob", "para", "por", "pelo", "pela", "pelos", "pelas", "ao", "aos", "à", "às", "que", "se", "lhe",
]);

/**
 * "Centro fora do cadastro" → "Centro Fora do Cadastro": iniciais maiúsculas,
 * como nos nomes das telas, das abas, dos títulos, dos rótulos das colunas,
 * dos indicadores e dos campos, menos nos artigos, preposições, conjunções e
 * pronomes do meio. O resto da palavra fica como está (siglas como DRE não
 * mudam), e o que está entre parênteses também ("Peso (kg)", "Centro de
 * Custo (opcional)").
 */
export function iniciaisMaiusculas(texto: string) {
  let parenteses = 0;
  return texto
    .split(" ")
    .map((p, i) => {
      const dentro = parenteses > 0 || p.startsWith("(");
      for (const c of p) {
        if (c === "(") parenteses++;
        else if (c === ")") parenteses = Math.max(0, parenteses - 1);
      }
      if (dentro) return p;
      if (i > 0 && MINUSCULAS.has(p.toLowerCase())) return p.toLowerCase();
      return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1);
    })
    .join(" ");
}
