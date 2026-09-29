import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type ParcelaRateio = { chave: string; destino: string; base: string; percentual: string; valor: string };
export type Composicao = { regra: string; direto?: string; rateios?: ParcelaRateio[]; observacao?: string };

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
  unidade: number;
  apuradoEm: string | null;
  congelado: boolean;
  linhas: LinhaDRE[];
};

export const dreService = {
  consultar: async (anoMes: string, unidade: number): Promise<DREUnidade> => {
    const { data } = await api.get<{ data: DREUnidade }>(`/proxy/competencias/${anoMes}/dre`, { params: { unidade } });
    return data.data;
  },
  apurar: async (anoMes: string): Promise<{ resultados: number; avisos: string[] }> => {
    const { data } = await api.post<{ data: { resultados: number; avisos: string[] } }>(`/proxy/competencias/${anoMes}/dre/apurar`);
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
