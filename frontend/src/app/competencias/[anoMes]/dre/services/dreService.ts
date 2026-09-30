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

export const dreService = {
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
