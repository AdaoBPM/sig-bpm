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
  /** As competências anteriores com entradas alteradas depois da apuração ("MM/AAAA"): enquanto houver, esta não se apura. */
  anterioresDesatualizadas: string[];
  /** A mensagem do bloqueio da apuração, ou null. */
  bloqueioApuracao: string | null;
  podeFechar: boolean;
  motivosNaoFechar: string[];
  podeReabrir: boolean;
  reaberturas: Array<{ justificativa: string; reabertaEm: string; reabertaPor: string; fechamentoAnteriorEm: string | null }>;
  /** Por que a competência não se exclui (só a mais recente, em aberto), ou null (20/10/2026). */
  motivoNaoExcluir: string | null;
  /** As telas do mês sem nenhum valor (21/10/2026): o aviso do Fechar Competência. */
  telasSemValor: string[];
  /** O que a exclusão leva junto (nula na fechada). */
  paraExcluir: ParaExcluir | null;
};

export type ParaExcluir = { importacoes: number; lancamentos: number; manuais: number; divergencias: number };

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
  excluir: async (anoMes: string): Promise<ParaExcluir> => {
    const { data } = await api.post<{ data: ParaExcluir }>(`${base(anoMes)}/excluir`);
    return data.data;
  },
  reabrir: async (anoMes: string, justificativa: string): Promise<SituacaoCompetencia> => {
    const { data } = await api.post<{ data: SituacaoCompetencia }>(`${base(anoMes)}/reabrir`, { justificativa });
    return data.data;
  },
};
