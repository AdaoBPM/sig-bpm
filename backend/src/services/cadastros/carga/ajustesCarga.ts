/**
 * Correções acordadas com a controladoria, aplicadas no momento da carga dos
 * cadastros.
 *
 * Ficam aqui, e não nos dados, porque a exportação da planilha é fiel:
 * misturar correção com origem tornaria impossível saber o que veio de onde.
 * Conforme a planilha for corrigida, cada ajuste deixa de encontrar
 * correspondência e a carga avisa — é o sinal de que a entrada pode sair daqui.
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

/**
 * O ERP repete o mesmo código de centro de custo em registros diferentes, o
 * que na planilha passa despercebido porque o ÍNDICE/CORRESP devolve a
 * primeira ocorrência. Aqui a chave é única, então a ambiguidade é resolvida
 * descartando os registros de nome antigo (acordado em 24/09/2026).
 */
export const CENTRO_CUSTO_DESCARTAR: Array<{ codigo: string; nomeRM: string; motivo: string }> = [
  { codigo: "1.01.00000004", nomeRM: "CONTROLADORIA", motivo: "nome antigo; vale CONTABILIDADE E CONTROLADORIA" },
  {
    codigo: "1.96.00000012",
    nomeRM: "BPM",
    motivo: "centro de movimentação de insumos de almoxarifado, sem classificação; mantida a primeira ocorrência",
  },
  {
    codigo: "1.96.00000013",
    nomeRM: "ESTOQUE ALMOXARIFADO",
    motivo: "centro de movimentação de insumos de almoxarifado, sem classificação; mantida a primeira ocorrência",
  },
];

/** Troca de código de um centro. Vazio desde 28/09/2026 (LABORATORIO incorporado à planilha). */
export const CENTRO_CUSTO_RENOMEAR: Array<{ codigo: string; nomeRM: string; novoCodigo: string; motivo: string }> = [];

/** Nome de controladoria. Vazio desde 28/09/2026 ("LABORATÓRIO (CRI)" incorporado à planilha). */
export const CENTRO_CUSTO_CONTROLADORIA: Array<{
  codigo: string;
  nomeRM: string;
  nomeControladoria: string;
  motivo: string;
}> = [];

/** Todos os ajustes previstos, com a chave que a carga marca ao aplicá-los. */
export function ajustesPrevistos() {
  return [
    ...AJUSTES_CONTA.map((a) => ({ chave: `conta:${a.reduzido}`, descricao: `ajuste da conta ${a.reduzido}` })),
    ...CENTRO_CUSTO_DESCARTAR.map((d) => ({ chave: `descartar:${d.codigo}:${d.nomeRM}`, descricao: `descartar ${d.nomeRM} (${d.codigo})` })),
    ...CENTRO_CUSTO_RENOMEAR.map((r) => ({ chave: `renomear:${r.codigo}:${r.nomeRM}`, descricao: `renomear ${r.nomeRM} (${r.codigo})` })),
    ...CENTRO_CUSTO_CONTROLADORIA.map((c) => ({ chave: `controladoria:${c.codigo}:${c.nomeRM}`, descricao: `controladoria de ${c.nomeRM}` })),
  ];
}
