import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type ParcelaRateio = { chave: string; destino: string; base: string; percentual: string; valor: string };
export type ParcelaUnidade = { unidade: number; nome: string; valor: string };
export type ParcelaCentro = { codigoRM: string | null; nome: string; valor: string };
export type Composicao = {
  regra: string;
  direto?: string;
  rateios?: ParcelaRateio[];
  unidades?: ParcelaUnidade[];
  centros?: ParcelaCentro[];
  observacao?: string;
};

export type LinhaDRE = {
  codigo: string;
  tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL";
  grupo: string;
  grupoSigla: string;
  descricao: string;
  valor: string | null;
  composicao: Composicao | null;
  /** O usuário alcança as movimentações desta linha (recorte por departamento). */
  podeDetalhar?: boolean;
};

export type DREUnidade = {
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  unidade?: number;
  apuradoEm: string | null;
  congelado: boolean;
  linhas: LinhaDRE[];
};

export type DRECentros = DREUnidade & { grupo: string; centros: Array<{ codigoRM: string | null; nome: string }> };

export type GruposCentros = {
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  apuradoEm: string | null;
  grupos: Array<{ grupo: string; departamentos: string[]; centros: number; total: string }>;
};

export type LancamentoDetalhe = {
  id: string;
  filial: number;
  centro: { codigoRM: string | null; nome: string | null } | null;
  conta: { reduzido: string; descricao: string };
  contaAdotada: { reduzido: string; descricao: string } | null;
  balde: string | null;
  alocacao: string | null;
  descricao?: string;
  valor: string;
  parcela: string;
};

export type BlocoDetalhe =
  | {
      tipo: "CONTABIL" | "RATEIO" | "MANUAL";
      titulo: string;
      unidade?: number;
      filtro: string;
      fator?: string;
      percentual?: string;
      total: string;
      lancamentos: LancamentoDetalhe[];
    }
  | { tipo: "PREVIA"; titulo: string; unidade: number; natureza: string; componente: string; sinal: number; total: string };

export type DetalheDRE = {
  competencia: { ano: number; mes: number };
  visao: string;
  linha: { codigo: string; descricao: string; tipo: LinhaDRE["tipo"] };
  valor: string | null;
  regra: string | null;
  observacao: string | null;
  somaOrigens: string | null;
  blocos: BlocoDetalhe[];
};

/** Em que visão o detalhamento é pedido: uma unidade, o consolidado ou um agrupamento de centros. */
export type VisaoDetalhe = { unidade: number } | { consolidado: true } | { grupo: string };

/** Uma linha do extrato das listas de uma linha de volume: os registros da obra somados. */
export type LinhaVolume = {
  obra: string | null;
  obraNome: string | null;
  /** A linha da aba Totais em que os registros entram, ex.: "(P) Pré-Fabricado: Matriz". */
  destino: string;
  linha: string | null;
  quantidade: string;
  registros: number;
};
export type VolumesDaLinha = { linha: string; medida: string | null; destinos: string[]; total: string; linhas: LinhaVolume[] };

export const dreService = {
  detalhe: async (anoMes: string, linha: string, visao: VisaoDetalhe): Promise<DetalheDRE> => {
    const params = { linha, ...("unidade" in visao ? { unidade: visao.unidade } : "grupo" in visao ? { grupo: visao.grupo } : {}) };
    const { data } = await api.get<{ data: DetalheDRE }>(`/proxy/competencias/${anoMes}/dre/detalhe`, { params });
    return data.data;
  },
  /** As listas que formam uma linha de volume (Produção, Expedição…), por obra; sem unidade, o consolidado. */
  volumes: async (anoMes: string, linha: string, unidade?: number): Promise<VolumesDaLinha> => {
    const { data } = await api.get<{ data: VolumesDaLinha }>(`/proxy/competencias/${anoMes}/dre/volumes`, { params: { linha, unidade } });
    return data.data;
  },
  consolidado: async (anoMes: string): Promise<DREUnidade> => {
    const { data } = await api.get<{ data: DREUnidade }>(`/proxy/competencias/${anoMes}/dre/consolidado`);
    return data.data;
  },
  grupos: async (anoMes: string): Promise<GruposCentros> => {
    const { data } = await api.get<{ data: GruposCentros }>(`/proxy/competencias/${anoMes}/dre/centros`);
    return data.data;
  },
  centros: async (anoMes: string, grupo: string): Promise<DRECentros> => {
    const { data } = await api.get<{ data: DRECentros }>(`/proxy/competencias/${anoMes}/dre/centros`, { params: { grupo } });
    return data.data;
  },
  consultar: async (anoMes: string, unidade: number): Promise<DREUnidade> => {
    const { data } = await api.get<{ data: DREUnidade }>(`/proxy/competencias/${anoMes}/dre`, { params: { unidade } });
    return data.data;
  },
  apurar: async (anoMes: string): Promise<{ resultados: number; consolidado: number; centros: number; avisos: string[] }> => {
    const { data } = await api.post<{ data: { resultados: number; consolidado: number; centros: number; avisos: string[] } }>(`/proxy/competencias/${anoMes}/dre/apurar`);
    return data.data;
  },
};

export const UNIDADES = [
  { codigo: 1, nome: "Matriz" },
  { codigo: 2, nome: "Filial" },
  { codigo: 3, nome: "Serviços" },
  { codigo: 4, nome: "Despesas e Extra" },
  { codigo: 5, nome: "RN" },
];

export const ROTULO_CHAVE: Record<string, string> = {
  PROJETO: "Projetos",
  PRODUCAO: "Produção",
  METALURGIA: "Metalurgia",
  ARMADURA: "Armadura",
  ACOMPANHAMENTO: "Acompanhamento",
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
