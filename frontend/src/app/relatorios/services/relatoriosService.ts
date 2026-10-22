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
  /**
   * Nas visões de Resultados Empresariais: o orçado do mês de referência e o acumulado, com o % e o R$/m³ (o cenário
   * Orçamento Empresarial; zero sem ele). Nos cenários com um cenário comparado (13/10/2026): só o total dele.
   */
  orcado?: { mes?: Celula; total: Celula } | null;
};

export type Resultados = {
  ano: number;
  ate: number;
  /** O cenário do orçado (o Orçamento Empresarial do exercício); null: nenhum (o orçado é zero). */
  cenarioOrcado?: string | null;
  /** O nome do comparado nos rótulos (21/10/2026): "Orçado" ou o nome da marcação escolhida no Compara Com. */
  rotuloComparado?: string;
  /** Nos cenários (13/10/2026): o cenário comparado, cujos totais vêm no lugar do orçado. */
  comparado?: { nome: string; ano: number } | null;
  meses: MesRelatorio[];
  linhas: LinhaResultado[];
  grupo?: string;
  /** Nos centros de custo: os centros do agrupamento com lançamento no período. */
  centros?: Array<{ codigoRM: string | null; nome: string }>;
  /** Nas obras: o código (centro 1.98 ou 1.99) e o nome da obra. */
  obra?: { codigo: string; nome: string };
};
/** As obras com lançamento no período, com o total do exercício (o Resultado Líquido; no recorte, a soma do que se vê). */
export type ObrasResultados = { ano: number; ate: number; obras: Array<{ codigo: string; nome: string; total: string }> };
/** Os grupos dos movimentos sem centro de custo com lançamento no período (14/10/2026), com o total do exercício. */
export type SemCentrosResultados = { ano: number; ate: number; grupos: Array<{ codigo: string; nome: string; total: string }> };
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
  /** A Média de Referência (os indicadores manuais dos analíticos, 15/10/2026). */
  referencia?: number | null;
};
export type Indicadores = {
  ano: number;
  ate: number;
  /** O cenário do orçado (o Orçamento Empresarial do exercício); null: nenhum (o orçado é zero). */
  cenarioOrcado?: string | null;
  /** O nome do comparado nos rótulos (21/10/2026): "Orçado" ou o nome da marcação escolhida no Compara Com. */
  rotuloComparado?: string;
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
  /** A Metodologia por extenso (21/10/2026), no lugar da abreviação no card. */
  metodologia?: string;
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
  rotuloComparado?: string;
  abas: Array<{ chave: string; titulo: string; quadros: QuadroPainel[] }>;
};

const periodo = (ano: number, ate?: number) => ({ ano, ...(ate ? { ate } : {}) });

/** As marcações dos cenários que o Compara Com escolhe (21/10/2026). */
export type MarcacaoComparavel = "ORCAMENTO_EMPRESARIAL" | "RESULTADOS_ANTERIORES" | "RESULTADOS_VENDIDOS" | "PREVISAO";
/** Um cenário marcado (o Compara Com): de qualquer exercício (22/10/2026), com o ano dele. */
export type Comparavel = { marcacao: MarcacaoComparavel; rotulo: string; cenario: { id: string; nome: string; ano: number } };
const comparado = (comparaCom?: MarcacaoComparavel) => (comparaCom && comparaCom !== "ORCAMENTO_EMPRESARIAL" ? { comparaCom } : {});

export const relatoriosService = {
  resultados: async (ano: number, ate: number | undefined, visao: number, comparaCom?: MarcacaoComparavel) =>
    (await api.get<{ data: Resultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao, ...comparado(comparaCom) } })).data.data,
  /** Os cenários marcados do exercício (21/10/2026): as opções do Compara Com. */
  comparaveis: async (ano: number) => (await api.get<{ data: Comparavel[] }>("/proxy/relatorios/comparaveis", { params: { ano } })).data.data,
  centros: async (ano: number, ate: number | undefined) =>
    (await api.get<{ data: CentrosResultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "centros" } })).data.data,
  semCentros: async (ano: number, ate: number | undefined) =>
    (await api.get<{ data: SemCentrosResultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "sem_centros" } })).data.data,
  semCentro: async (ano: number, ate: number | undefined, grupo: string) =>
    (await api.get<{ data: Resultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "sem_centros", grupo } })).data.data,
  obras: async (ano: number, ate: number | undefined) =>
    (await api.get<{ data: ObrasResultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "obras" } })).data.data,
  obra: async (ano: number, ate: number | undefined, obra: string) =>
    (await api.get<{ data: Resultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "obras", obra } })).data.data,
  centro: async (ano: number, ate: number | undefined, grupo: string) =>
    (await api.get<{ data: Resultados }>("/proxy/relatorios/resultados", { params: { ...periodo(ano, ate), visao: "centros", grupo } })).data.data,
  /** `etapa`: a etapa Indicadores do Fechamento Mensal, que vê o mês aberto; sem ela, só as competências fechadas. */
  indicadores: async (ano: number, ate: number | undefined, etapa = false, comparaCom?: MarcacaoComparavel) =>
    (await api.get<{ data: Indicadores }>("/proxy/relatorios/indicadores", { params: { ...periodo(ano, ate), ...(etapa ? { etapa: 1 } : {}), ...comparado(comparaCom) } })).data.data,
  painel: async (ano: number, ate: number | undefined, comparaCom?: MarcacaoComparavel) =>
    (await api.get<{ data: Painel }>("/proxy/relatorios/painel", { params: { ...periodo(ano, ate), ...comparado(comparaCom) } })).data.data,
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

/**
 * A escala do gráfico na unidade do indicador (22/10/2026): os percentuais em %, o R$ M em milhões e o R$ K em milhares
 * (como os valores aparecem).
 */
export const fatorDaEscalaDa = (unidade: string) => (unidade === "%" ? 100 : unidade === "R$ M" ? 1e-6 : unidade === "R$ K" ? 1e-3 : 1);
