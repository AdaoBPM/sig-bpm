import { api } from "@/lib/api";

import type { StatusCompetencia } from "./competenciasService";

/** A situação da competência: estado, apuração congelada, o que mudou depois e o que falta para fechar. */
export type SituacaoCompetencia = {
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  apurada: boolean;
  apuradaEm: string | null;
  apuradaPor: string | null;
  apuracoes: number;
  fechadaEm: string | null;
  fechadaPor: string | null;
  mudancas: string[];
  pendenciasClassificacao: number;
  podeApurar: boolean;
  podeFechar: boolean;
  motivosNaoFechar: string[];
  podeReabrir: boolean;
  reaberturas: Array<{ justificativa: string; reabertaEm: string; reabertaPor: string; fechamentoAnteriorEm: string | null }>;
};

export type ResultadoApuracao = { apuradaEm: string; apuracoes: number; etapas: string[]; avisos: string[] };

const base = (anoMes: string) => `/proxy/competencias/${anoMes}/apuracao`;

export const apuracaoService = {
  situacao: async (anoMes: string): Promise<SituacaoCompetencia> => {
    const { data } = await api.get<{ data: SituacaoCompetencia }>(base(anoMes));
    return data.data;
  },
  apurar: async (anoMes: string): Promise<ResultadoApuracao> => {
    const { data } = await api.post<{ data: ResultadoApuracao }>(`${base(anoMes)}/apurar`);
    return data.data;
  },
  fechar: async (anoMes: string): Promise<SituacaoCompetencia> => {
    const { data } = await api.post<{ data: SituacaoCompetencia }>(`${base(anoMes)}/fechar`);
    return data.data;
  },
  reabrir: async (anoMes: string, justificativa: string): Promise<SituacaoCompetencia> => {
    const { data } = await api.post<{ data: SituacaoCompetencia }>(`${base(anoMes)}/reabrir`, { justificativa });
    return data.data;
  },
};
