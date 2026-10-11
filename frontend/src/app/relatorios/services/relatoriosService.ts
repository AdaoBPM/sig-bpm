import { api } from "@/lib/api";

export type MesRelatorio = { mes: number; rotulo: string; apurado: boolean };
/** Valor, participação (fração: 0,25 = 25%) e valor unitário (R$/m³); null quando não se aplica ou o mês não foi apurado. */
export type Celula = { valor: number | null; pct: number | null; unitario: number | null };

export type LinhaResultado = {
  codigo: string;
  tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL";
  grupo: string;
  grupoSigla: string;
  descricao: string;
  /** Linha de volume (m³, kg, pistas, dias): sem % nem R$/m³. */
  volume: boolean;
  /** O usuário alcança os lançamentos da linha (o recorte do Gestor por departamento). */
  podeDetalhar: boolean;
  meses: Celula[];
  total: Celula;
};

export type Resultados = {
  ano: number;
  ate: number;
  meses: MesRelatorio[];
  linhas: LinhaResultado[];
  grupo?: string;
  /** Nos centros de custo: os centros do agrupamento com lançamento no período. */
  centros?: Array<{ codigoRM: string | null; nome: string }>;
};
export type CentrosResultados = { ano: number; ate: number; grupos: Array<{ grupo: string; departamentos: string[]; total: string }> };

export type Indicador = {
  grupo: string;
  numero: string;
  nome: string;
  sentido: string;
  unidade: string;
  metodologia: string;
  acumulado: "ACUM" | "ATUAL";
  meses: Array<number | null>;
  total: number | null;
  /** O orçado de cada mês e o acumulado do orçado: o cenário Orçamento Empresarial do exercício (zero sem ele). */
  orcado: Array<number | null>;
  totalOrcado: number | null;
};
export type Indicadores = {
  ano: number;
  ate: number;
  /** O cenário do orçado (o Orçamento Empresarial do exercício); null: nenhum (o orçado é zero). */
  cenarioOrcado?: string | null;
  meses: MesRelatorio[];
  indicadores: Indicador[];
};

/** Os formatos das células do Painel de Bordo, como na planilha. */
export type FormatoPainel = "MILHOES" | "MILHARES" | "M3" | "PISTAS" | "PCT" | "PCT_RL" | "RS_M3";
/** O item num período: realizado, orçado, o percentual sob o realizado, o desvio (fração) e o sinal (1 melhor, 0 dentro de 5%, −1 pior). */
export type BlocoPainel = { realizado: number | null; orcado: number | null; base: number | null; vsOrcado: number | null; sinal: -1 | 0 | 1 | null };
export type ItemPainel = {
  titulo: string;
  sigla: string;
  sentido: "↑" | "↓";
  formato: FormatoPainel;
  formatoAcumulado: FormatoPainel;
  base: { rotulo: string; casas: 1 | 2 } | null;
  separar: boolean;
  mes: BlocoPainel;
  acumulado: BlocoPainel;
  /** Os meses do exercício até o de referência (os gráficos): o realizado e o orçado de cada um. */
  serie: Array<{ mes: string; realizado: number | null; orcado: number | null }>;
};
export type QuadroPainel = { titulo: string; itens: ItemPainel[] };
export type Painel = {
  ano: number;
  ate: number;
  rotuloMes: string;
  rotuloAcumulado: string;
  mesApurado: boolean;
  mesesSemMeta: string[];
  /** O cenário do orçado (o Orçamento Empresarial do exercício); null: nenhum (o orçado é zero). */
  cenarioOrcado: string | null;
  abas: Array<{ chave: string; titulo: string; quadros: QuadroPainel[] }>;
};

const periodo = (ano: number, ate?: number) => ({ ano, ...(ate ? { ate } : {}) });

export const relatoriosService = {
  resultados: async (ano: number, ate: number | undefined, visao: number) =>
    (await api.get<{ data: Resultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao } })).data.data,
  centros: async (ano: number, ate: number | undefined) =>
    (await api.get<{ data: CentrosResultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "centros" } })).data.data,
  centro: async (ano: number, ate: number | undefined, grupo: string) =>
    (await api.get<{ data: Resultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "centros", grupo } })).data.data,
  indicadores: async (ano: number, ate: number | undefined) =>
    (await api.get<{ data: Indicadores }>("/proxy/relatorios/indicadores", { params: periodo(ano, ate) })).data.data,
  painel: async (ano: number, ate: number | undefined) =>
    (await api.get<{ data: Painel }>("/proxy/relatorios/painel", { params: periodo(ano, ate) })).data.data,
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}

// signDisplay "negative": o que arredonda para zero sai sem o sinal ("0", e não "-0").
const numero = (casas: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas, signDisplay: "negative" });
const n0 = numero(0);
const n1 = numero(1);
const n2 = numero(2);

/** Os formatos dos relatórios, como nas planilhas: valores com duas casas, sem o símbolo da moeda (a tabela é larga). */
export const formato = {
  valor: (v: number) => n2.format(v),
  pct: (v: number) => `${n1.format(v * 100)}%`,
  inteiro: (v: number) => n0.format(v),
  umaCasa: (v: number) => n1.format(v),
};
