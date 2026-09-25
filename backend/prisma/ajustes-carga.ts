/**
 * Correções acordadas com a controladoria, aplicadas no momento da carga.
 *
 * Ficam aqui, e não nos JSON, porque os JSON são exportação fiel da planilha:
 * misturar correção com origem tornaria impossível saber o que veio de onde.
 * Conforme a planilha for corrigida, cada ajuste deixa de encontrar
 * correspondência e os carregadores avisam — é o sinal de que a entrada pode
 * sair daqui.
 *
 * Este módulo é compartilhado por `carga-inicial.ts` e `carga-dre.ts`: o
 * primeiro grava os campos da conta, o segundo usa os mesmos valores para
 * vincular a conta à linha da DRE. Mantê-los em um só lugar evita que os dois
 * carregadores divirjam e produzam um cadastro gravado de um jeito e vinculado
 * de outro.
 */

export type AjusteConta = {
  /** Chave natural da conta de resultado. */
  reduzido: string;
  departamento?: string;
  depSigla?: string;
  atribuicao?: string;
  atrSigla?: string;
  contaDRE?: string;
  motivo: string;
};

export const AJUSTES_CONTA: AjusteConta[] = [
  {
    reduzido: "968041",
    // 3.02.01.02.05.02.01 — SERVICOS DE TERCEIROS
    depSigla: "CPP",
    atribuicao: "Gastos Gerais Diretos",
    atrSigla: "GGD",
    contaDRE: "Outros Custos/Despesas",
    motivo:
      'a sigla era CSC, incoerente com o departamento "CUSTOS DE PRODUÇÃO (CP)", ' +
      'e o destino "Serviços de Montagem Diversos" só existe em Custos de Serviços — ' +
      "reclassificada em Gastos Gerais Diretos / Outros Custos/Despesas",
  },
];

/** Registra quais ajustes foram efetivamente aplicados nesta carga. */
export const ajustesContaUsados = new Set<string>();

export function ajusteDaConta(reduzido: string | null): AjusteConta | undefined {
  if (!reduzido) return undefined;
  const a = AJUSTES_CONTA.find((x) => x.reduzido === reduzido);
  if (a) ajustesContaUsados.add(a.reduzido);
  return a;
}

export function relatarAjustesConta(): void {
  console.log(
    `\nAjustes de conta aplicados: ${ajustesContaUsados.size} de ${AJUSTES_CONTA.length}`,
  );
  for (const a of AJUSTES_CONTA) {
    const estado = ajustesContaUsados.has(a.reduzido)
      ? "aplicado"
      : "sem correspondência (planilha já corrigida?)";
    console.log(`  ${a.reduzido}: ${estado}`);
  }
}
