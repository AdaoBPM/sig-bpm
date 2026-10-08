import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type SaldoEstoque = {
  obra: string;
  nomeObra: string;
  linha: string;
  unidade: string;
  movimentoVolume: string;
  movimentoValor: string;
  precoMovimento: string | null;
  criterio: string | null;
  saldoVolume: string;
  saldoValor: string;
  precoMedio: string;
};

export type Estoque = {
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  apuradoEm: string | null;
  congelado: boolean;
  /** O mês parte do saldo inicial importado (o primeiro mês da ferramenta), não do mês anterior. */
  inicial: boolean;
  medias: Array<{ linha: string; volume: string; valor: string; precoMedio: string }>;
  saldos: SaldoEstoque[];
  avisos?: string[];
};

export const estoqueService = {
  consultar: async (anoMes: string): Promise<Estoque> => {
    const { data } = await api.get<{ data: Estoque }>(`/proxy/competencias/${anoMes}/estoque`);
    return data.data;
  },
  apurar: async (anoMes: string): Promise<Estoque> => {
    const { data } = await api.post<{ data: Estoque }>(`/proxy/competencias/${anoMes}/estoque/apurar`);
    return data.data;
  },
};

export const ROTULO_CRITERIO_ESTOQUE: Record<string, string> = {
  CONTRATO: "Preço do contrato",
  SEM_CONTRATO: "Sem contrato — padrão",
  GENERICA: "Obra genérica — padrão",
  TABELA_ESTACA: "Tabela de estacas",
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
