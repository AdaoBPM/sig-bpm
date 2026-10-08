import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type StatusDivergencia = "ABERTA" | "JUSTIFICADA" | "RESOLVIDA_POR_REABERTURA" | "RESOLVIDA_POR_REAPURACAO";
export type TipoDivergencia = "BALANCETE" | "PRECO_CONTRATO";

export type Divergencia = {
  id: string;
  tipo: TipoDivergencia;
  status: StatusDivergencia;
  descricao: string | null;
  valorGravado: string;
  valorRecebido: string;
  diferenca: string;
  impacto: string | null;
  detectadaEm: string;
  justificativa: string | null;
  tratadaEm: string | null;
  tratadaPor: string | null;
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  importacao: { nomeArquivo: string; importadoEm: string; comparacao: boolean };
};

export type ListaDivergencias = {
  itens: Divergencia[];
  total: number;
  pagina: number;
  porPagina: number;
  competencias: Array<{ ano: number; mes: number; status: StatusCompetencia; abertas: number; total: number }>;
};

export type FiltroDivergencias = { competencia?: string; tipo?: TipoDivergencia; status?: StatusDivergencia };

export const ROTULO_STATUS: Record<StatusDivergencia, string> = {
  ABERTA: "Aberta",
  JUSTIFICADA: "Justificada",
  RESOLVIDA_POR_REABERTURA: "Resolvida por reabertura",
  RESOLVIDA_POR_REAPURACAO: "Resolvida por reapuração",
};
export const ROTULO_TIPO: Record<TipoDivergencia, string> = { BALANCETE: "Balancete", PRECO_CONTRATO: "Preço de contrato" };

export const divergenciasService = {
  listar: async (f: FiltroDivergencias & { pagina: number; porPagina: number }): Promise<ListaDivergencias> => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ""));
    return (await api.get<{ data: ListaDivergencias }>("/proxy/divergencias", { params })).data.data;
  },
  justificar: async (ids: string[], justificativa: string) => (await api.post<{ data: { justificadas: number } }>("/proxy/divergencias/justificar", { ids, justificativa })).data.data,
  resolver: async (competencia: string, justificativa: string) =>
    (await api.post<{ data: { resolvidas: number } }>("/proxy/divergencias/resolver", { competencia, justificativa })).data.data,
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
