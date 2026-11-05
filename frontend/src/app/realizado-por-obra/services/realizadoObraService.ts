import { api } from "@/lib/api";

import type { Resultados } from "@/app/relatorios/services/relatoriosService";

/** A venda dos Resultados (03/11/2026): a obra principal dela, o código (sem a numeração) e o nome. */
export type ObraDoRealizado = {
  id: string;
  codigo: string;
  nome: string;
  tipoVenda: "GLOBAL" | "MERCANTIL" | null;
  generica: boolean;
  unidade: string | null;
  linha: string | null;
};
/** A DRE do Comercial que dá o vendido: a competência fechada em que foi importada, o arquivo e quando. */
export type FonteDoVendido = { competencia: string; arquivo: string; importadoEm: string } | null;

/** Uma opção da lista Venda: a venda numa versão vendida (sem o vendido, `versao` nula). */
export type OpcaoDeVenda = {
  obraId: string;
  codigo: string;
  nome: string;
  tipoVenda: "GLOBAL" | "MERCANTIL" | null;
  generica: boolean;
  comRealizado: boolean;
  versao: number | null;
};
export type VendasDoRealizado = {
  vendas: OpcaoDeVenda[];
  /** A escolhida pelo usuário, com a versão que vale; nula sem a escolha. */
  escolhida: { obraId: string; versao: number | null } | null;
  fonte: FonteDoVendido;
  indisponivel: string | null;
};
/** A composição de um item num mês (as consultas): o direto (os lançamentos dos centros da obra), o rateio da linha e os créditos de impostos. */
export type Composicao = { direto: number; rateio: number; creditos: number };
/**
 * Uma aba dos Resultados da obra: o Consolidado ou uma linha, com a DRE no formato da tabela de Resultados e a composição de
 * cada item em cada mês.
 */
export type AbaDaObra = { chave: string; nome: string; unidade: number | null; nomeUnidade: string | null; composicao: Record<string, Array<Composicao | null>>; dados: Resultados };
export type ResultadosDaObra = {
  obra: ObraDoRealizado | null;
  versao: number;
  versoes: number[];
  fonte: FonteDoVendido;
  /** As competências fechadas sem as obras gravadas (a etapa Linhas do mês grava). */
  semObras: string[];
  avisos: string[];
  abas: AbaDaObra[];
  /** O centro de obra da venda em cada mês (as consultas dos lançamentos); nulo, o mês sem as obras gravadas. */
  centros: Array<string | null>;
  /** Os códigos das obras da venda (as consultas dos volumes). */
  obras: string[];
};

/**
 * A memória de cálculo de um subtotal agrupado (a Mão de Obra e os Gastos Gerais, Diretos e Indiretos) num mês: em cada linha,
 * o custo dela sem os centros de obra, a base (da linha e da venda), a parte calculada, a gravada (o rateio), o direto e as contas.
 */
export type MemoriaDoRateio = {
  venda: ObraDoRealizado;
  descricao: string;
  mes: string;
  aba: string;
  total: number;
  blocos: Array<{
    linha: string;
    unidade: string | null;
    rateado: number;
    base: { nome: string; medida: string; doExercicio: boolean; total: number; daVenda: number } | null;
    calculado: number;
    rateio: number;
    direto: number;
    total: number;
    confere: boolean;
    contas: Array<{ codigo: string; descricao: string; rateado: number; rateio: number; direto: number }>;
  }>;
};

/** "VER00". */
export const rotuloDaVersao = (versao: number) => `VER${String(versao).padStart(2, "0")}`;
export const ROTULO_DA_VENDA = { GLOBAL: "Venda Global", MERCANTIL: "Venda Mercantil" } as const;

const base = "/proxy/realizado-por-obra";
export const realizadoObraService = {
  vendas: async () => (await api.get<{ data: VendasDoRealizado }>(`${base}/vendas`)).data.data,
  escolher: async (obraId: string, versao: number) => {
    await api.put(`${base}/venda`, { obraId, versao });
  },
  resultados: async () => (await api.get<{ data: ResultadosDaObra }>(`${base}/resultados`)).data.data,
  /** `mes`: AAAAMM; `aba`: consolidado ou o id da linha; `codigo`: o subtotal da DRE. */
  memoria: async (mes: number, aba: string, codigo: string) => (await api.get<{ data: MemoriaDoRateio }>(`${base}/memoria`, { params: { mes, aba, codigo } })).data.data,
};
