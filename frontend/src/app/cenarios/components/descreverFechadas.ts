const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * "Fechada: de Janeiro a Agosto." (14/10/2026; antes, "Fechadas de…"): os meses seguidos, pelo primeiro e o último; um
 * mês só, "Fechada: Janeiro."; fora de sequência, cada trecho seguido pelo primeiro e o último ("Fechada: de Janeiro a
 * Março e Maio."). Também na referência dos analíticos.
 */
export function descreverFechadas(ms: number[]) {
  if (ms.length === 0) return "Nenhuma fechada.";
  const trechos: number[][] = [];
  for (const m of ms) {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && m === ultimo[ultimo.length - 1] + 1) ultimo.push(m);
    else trechos.push([m]);
  }
  const textos = trechos.map((t) => (t.length === 1 ? MESES[t[0] - 1] : `de ${MESES[t[0] - 1]} a ${MESES[t[t.length - 1] - 1]}`));
  return `Fechada: ${textos.length === 1 ? textos[0] : `${textos.slice(0, -1).join(", ")} e ${textos[textos.length - 1]}`}.`;
}
