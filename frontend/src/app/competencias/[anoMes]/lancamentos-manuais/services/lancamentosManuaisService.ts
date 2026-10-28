import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type ContaOpcao = {
  id: string;
  reduzido: string;
  descricao: string;
  departamento: string | null;
  atribuicao: string | null;
};

export type CentroOpcao = { id: string; codigoRM: string | null; nomeRM: string };

export type LancamentoManual = {
  id: string;
  motivo: string;
  filial: number;
  descricao: string;
  valor: string;
  balde: string | null;
  atualizadoEm: string;
  centroCusto: { id: string; codigoRM: string | null; nomeRM: string } | null;
  contaResultado: ContaOpcao | null;
  linhaDRE: { codigo: string; descricao: string; grupo: string } | null;
  /** A contestação de que o lançamento veio (27/10/2026: a aba Contestações). */
  contestacao: { id: string; numero: number; item: string | null; solicitante: string; competencia: string } | null;
};

export type ListaLancamentos = {
  competencia: { id: string; ano: number; mes: number; status: StatusCompetencia };
  itens: LancamentoManual[];
  total: string;
};

export type OpcoesLancamento = { contas: ContaOpcao[]; centros: CentroOpcao[]; motivos: string[] };

export type LancamentoEntrada = {
  motivo: string;
  filial: number;
  centroCustoId: string | null;
  contaResultadoId: string;
  descricao: string;
  valor: string;
};

export const lancamentosManuaisService = {
  listar: async (anoMes: string): Promise<ListaLancamentos> => {
    const { data } = await api.get<{ data: ListaLancamentos }>(`/proxy/competencias/${anoMes}/lancamentos-manuais`);
    return data.data;
  },
  /** Os lançamentos das contestações (27/10/2026: a aba Contestações). */
  listarContestacoes: async (anoMes: string): Promise<ListaLancamentos> => {
    const { data } = await api.get<{ data: ListaLancamentos }>(`/proxy/competencias/${anoMes}/lancamentos-manuais/contestacoes`);
    return data.data;
  },
  opcoes: async (): Promise<OpcoesLancamento> => {
    const { data } = await api.get<{ data: OpcoesLancamento }>("/proxy/lancamentos-manuais/opcoes");
    return data.data;
  },
  criar: async (anoMes: string, entrada: LancamentoEntrada) => {
    const { data } = await api.post<{ data: LancamentoManual }>(`/proxy/competencias/${anoMes}/lancamentos-manuais`, entrada);
    return data.data;
  },
  atualizar: async (id: string, entrada: LancamentoEntrada) => {
    const { data } = await api.put<{ data: LancamentoManual }>(`/proxy/lancamentos-manuais/${id}`, entrada);
    return data.data;
  },
  excluir: async (id: string) => {
    await api.delete(`/proxy/lancamentos-manuais/${id}`);
  },
  copiarAnterior: async (anoMes: string) => {
    const { data } = await api.post<{ data: { copiados: number } }>(
      `/proxy/competencias/${anoMes}/lancamentos-manuais/copiar-anterior`,
    );
    return data.data;
  },
};

/** Mensagem pronta que o backend manda nos erros de regra. */
export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
