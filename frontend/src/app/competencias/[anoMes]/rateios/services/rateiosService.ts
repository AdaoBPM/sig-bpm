import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type DestinoRateio = {
  destino: string;
  rotulo: string;
  origem: string;
  quantidade: string;
  percentual: string;
  /** Volume de hoje, quando as listas mudaram depois da apuração. */
  quantidadeAtual: string | null;
};

export type ChaveRateio = { chave: string; baseFisica: string; total: string; destinos: DestinoRateio[] };

export type Rateios = {
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  apuradoEm: string | null;
  congelado: boolean;
  chaves: ChaveRateio[];
  totais: Array<{ codigo: string; rotulo: string; medida: string; tipo: string; quantidade: string }>;
};

export const rateiosService = {
  consultar: async (anoMes: string): Promise<Rateios> => {
    const { data } = await api.get<{ data: Rateios }>(`/proxy/competencias/${anoMes}/rateios`);
    return data.data;
  },
  apurar: async (anoMes: string): Promise<Rateios> => {
    const { data } = await api.post<{ data: Rateios }>(`/proxy/competencias/${anoMes}/rateios/apurar`);
    return data.data;
  },
};

export const ROTULO_CHAVE: Record<string, string> = {
  PROJETO: "Projetos Liberados",
  PRODUCAO: "Pré-Fabricado",
  METALURGIA: "Metalurgia",
  ARMADURA: "Armadura",
  ACOMPANHAMENTO: "Acompanhamento de Obra",
};

export const MEDIDA_BASE: Record<string, string> = { M3: "m³", KG: "kg", PISTA: "pistas", DIA: "dias" };

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
