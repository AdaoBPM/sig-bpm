import { api } from "@/lib/api";

import type { SituacaoContestacao } from "@/app/competencias/[anoMes]/dre/services/dreService";

export type { SituacaoContestacao };

/** Uma contestação de gasto (27/10/2026): o item do balancete, o antes e o depois, a situação e quem fez o quê. */
export type Contestacao = {
  id: string;
  numero: number;
  /** A competência do item ("09/2026"). */
  competencia: string;
  competenciaFechada: boolean;
  /** O item ainda está no balancete (uma reimportação pode tê-lo tirado). */
  comItem: boolean;
  filial: number;
  emissao: string | null;
  cliForn: string | null;
  historico: string | null;
  valor: string;
  contaBalancete: string | null;
  centroAntes: string | null;
  contaAntes: string | null;
  centroNovo: string | null;
  contaNova: string | null;
  motivo: string | null;
  situacao: SituacaoContestacao;
  solicitante: string;
  solicitanteId: string;
  solicitadaEm: string;
  respondidaPor: string | null;
  respondidaEm: string | null;
  justificativa: string | null;
  justificadaPor: string | null;
  justificadaEm: string | null;
  validadaPor: string | null;
  validadaEm: string | null;
  formaValidacao: "NO_BALANCETE" | "LANCAMENTO_MANUAL" | null;
  /** A competência em que a contestação virou lançamentos manuais. */
  lancadaEm: string | null;
  responsaveis: string[];
  souResponsavel: boolean;
};

export type CentroOpcao = { id: string; codigoRM: string | null; nomeRM: string; departamento: string | null };
export type ContaOpcao = { id: string; reduzido: string; descricao: string; departamento: string | null; atribuicao: string | null };

export const ROTULO_SITUACAO: Record<SituacaoContestacao, string> = { PENDENTE: "Pendente", ACATADA: "Acatada", RECUSADA: "Recusada", VALIDADA: "Validada" };

export function mensagemDeErro(e: unknown, padrao: string) {
  const r = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return r || padrao;
}

export const contestacoesService = {
  opcoes: async (): Promise<{ centros: CentroOpcao[]; contas: ContaOpcao[] }> => (await api.get("/proxy/contestacoes/opcoes")).data.data,
  criar: async (d: { lancamentoId: string; centroNovoId: string | null; contaNovaId: string | null; motivo: string | null }): Promise<Contestacao> =>
    (await api.post("/proxy/contestacoes", d)).data.data,
  listar: async (aba: "solicitadas" | "recebidas" | "validacoes"): Promise<Contestacao[]> => (await api.get(`/proxy/contestacoes/${aba}`)).data.data,
  responder: async (id: string, d: { acatar: boolean; justificativa: string | null }): Promise<Contestacao> => (await api.post(`/proxy/contestacoes/${id}/responder`, d)).data.data,
  alterarSituacao: async (id: string, d: { situacao: SituacaoContestacao; justificativa: string }): Promise<Contestacao> => (await api.post(`/proxy/contestacoes/${id}/situacao`, d)).data.data,
  processar: async (): Promise<{ validadas: number; paraLancamentos: number; reclassificadas: string[]; reapurar: string[] }> => (await api.post("/proxy/contestacoes/processar")).data.data,
  paraLancamentos: async (anoMes: string): Promise<Contestacao[]> => (await api.get(`/proxy/competencias/${anoMes}/contestacoes/pendentes`)).data.data,
  importar: async (anoMes: string, ids: string[]): Promise<{ importadas: number; recusadas: Array<{ numero: number; motivo: string }> }> =>
    (await api.post(`/proxy/competencias/${anoMes}/contestacoes/importar`, { ids })).data.data,
  desfazerImportacao: async (id: string): Promise<void> => {
    await api.delete(`/proxy/contestacoes/${id}/importacao`);
  },
};
