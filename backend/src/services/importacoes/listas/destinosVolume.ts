import type { CodigoUnidade } from "./leituraListas.js";

/**
 * Para onde vai cada volume de rateio. É a tradução, por nome, do que a aba
 * Totais do BASE REALIZADO (OPERAÇÃO) faz por posição de linha — a posição
 * foi a origem do erro de metalurgia e armadura corrigido em 28/09/2026.
 *
 * MONTAGEM e COMPLEMENTAR são as duas frentes da unidade de Serviços.
 */
export type Destino = "MATRIZ" | "FILIAL" | "MONTAGEM" | "COMPLEMENTAR";

export const UNIDADE_DO_DESTINO: Record<Destino, CodigoUnidade> = {
  MATRIZ: 1,
  FILIAL: 2,
  MONTAGEM: 3,
  COMPLEMENTAR: 3,
};

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
}

/**
 * Produção (Metalúrgica) do LISTAS REALIZADO (OPERAÇÃO), por finalidade. Espelha os totais da própria
 * aba: TOTAL: MATRIZ = Inserto + Manutenção Matriz + Investimento Matriz, e
 * assim por diante. O investimento separado por unidade (desde 09/10/2026)
 * entra no rateio da unidade, como o total da aba; o INVESTIMENTO antigo, sem
 * unidade, não entra.
 */
const FINALIDADES: Record<string, Destino | null> = {
  "INSERTO METALICO": "MATRIZ",
  "MANUTENCAO: MATRIZ": "MATRIZ",
  "ANEL E LUVA": "FILIAL",
  "MANUTENCAO: FILIAL": "FILIAL",
  FERRAGEM: "MONTAGEM",
  "MANUTENCAO: OBRAS": "MONTAGEM",
  "ESTRUTURA METALICA": "COMPLEMENTAR",
  INVESTIMENTO: null,
  // Investimento por unidade (desde 09/10/2026): entra na conta da unidade (decisão de 09/10/2026).
  "INVESTIMENTO: MATRIZ": "MATRIZ",
  "INVESTIMENTO: FILIAL": "FILIAL",
  "INVESTIMENTO: OBRAS": "MONTAGEM",
};

/** undefined: finalidade desconhecida; null: conhecida e fora do rateio. */
export function destinoDaFinalidade(finalidade: string): Destino | null | undefined {
  return FINALIDADES[semAcento(finalidade)];
}

/**
 * Linhas da Produção (Armaduras) (antes, Produção (Lista Arm.)). Até 08/10/2026, uma coluna só
 * (UNIDADE/LINHA: "Matriz (kg)", "Ferragem (kg)"…); desde 09/10/2026, as
 * colunas Unidade, Linha e Und., e a categoria guardada é a Linha.
 */
const CATEGORIAS_ARMADURA: Record<string, Destino> = {
  "MATRIZ (KG)": "MATRIZ",
  "FILIAL (KG)": "FILIAL",
  "FERRAGEM (KG)": "MONTAGEM",
  "FUNDACAO (KG)": "COMPLEMENTAR",
  "CAPEAM. (KG)": "COMPLEMENTAR",
  "METALICA (KG)": "COMPLEMENTAR",
  "TURN KEY (KG)": "COMPLEMENTAR",
  ESTRUTURA: "MATRIZ",
  ALVEOLARES: "FILIAL",
  MONTAGEM: "MONTAGEM",
  FUNDACAO: "COMPLEMENTAR",
  CAPEAMENTO: "COMPLEMENTAR",
  METALICA: "COMPLEMENTAR",
  "TURN-KEY": "COMPLEMENTAR",
};

export function destinoDaArmadura(categoria: string): Destino | undefined {
  return CATEGORIAS_ARMADURA[semAcento(categoria)];
}

/** Acompanhamento de obra: MONTAGEM e SAC são da Montagem; o resto, Complementar. */
export function destinoDoAcompanhamento(etapa: string | null): "MONTAGEM" | "COMPLEMENTAR" {
  const e = semAcento(etapa ?? "");
  return e === "MONTAGEM" || e === "SAC" ? "MONTAGEM" : "COMPLEMENTAR";
}
