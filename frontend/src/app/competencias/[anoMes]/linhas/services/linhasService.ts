import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

/** A etapa Linhas (26/10/2026): a DRE de cada unidade dividida entre as linhas, gravada na apuração. */
export type LinhasDoMes = {
  situacao: { status: StatusCompetencia; apurada: boolean; gravadaEm: string | null; podeGravar: boolean };
  unidades: Array<{ unidade: number; nome: string; mcDaDRE: number; mcDasLinhas: number; semLinha: number }>;
  /** De que passo da Alocação nas Linhas veio cada valor: Matriz, Filial e Serviços. */
  niveis: Array<{ nivel: string; rotulo: string; porUnidade: number[] }>;
  documentos: { requisicoes: number; notas: number } | null;
  avisos: string[];
  linhas: Array<{ id: string; codigo: string; nome: string; unidade: number; nomeUnidade: string; ativo: boolean; receitaLiquida: number | null; mc: number | null }>;
};

export const linhasService = {
  doMes: async (anoMes: string) => (await api.get<{ data: LinhasDoMes }>(`/proxy/competencias/${anoMes}/linhas`)).data.data,
  /** Grava as linhas de uma competência fechada antes da etapa Linhas. */
  gravar: async (anoMes: string) => (await api.post<{ data: LinhasDoMes }>(`/proxy/competencias/${anoMes}/linhas/gravar`)).data.data,
};
