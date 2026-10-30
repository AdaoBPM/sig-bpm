import { api } from "@/lib/api";

import type { SituacaoContestacao } from "@/app/competencias/[anoMes]/dre/services/dreService";

export type { SituacaoContestacao };

/** Um movimento de uma contestação (30/10/2026): o contestado (o principal) ou um das anteriores e posteriores. */
export type MovimentoDaContestacao = {
  id: string;
  principal: boolean;
  competencia: string;
  competenciaFechada: boolean;
  comItem: boolean;
  filial: number;
  emissao: string | null;
  cliForn: string | null;
  historico: string | null;
  valor: string;
  formaValidacao: "NO_BALANCETE" | "LANCAMENTO_MANUAL" | null;
};

/** Uma contestação de gasto (27/10/2026): os movimentos, o antes e o depois, a situação e quem fez o quê. */
export type Contestacao = {
  id: string;
  numero: number;
  /** A competência do movimento contestado ("09/2026"). */
  competencia: string;
  /** As competências dos movimentos, em ordem (com as anteriores e as posteriores). */
  competencias: string[];
  competenciaFechada: boolean;
  /** O item ainda está no balancete (uma reimportação pode tê-lo tirado). */
  comItem: boolean;
  filial: number;
  emissao: string | null;
  cliForn: string | null;
  historico: string | null;
  /** O valor dos movimentos todos. */
  valor: string;
  /** O valor do movimento contestado. */
  valorDoMovimento: string;
  anteriores: boolean;
  posteriores: boolean;
  movimentos: MovimentoDaContestacao[];
  /** A correção dos movimentos: no balancete, pelos lançamentos, os que o Processar corrige e os que esperam o Importar. */
  correcao: {
    noBalancete: number;
    porLancamentos: number;
    diretos: number;
    paraLancamentos: number;
    valorParaLancamentos: string;
    competenciasParaLancamentos: string[];
  };
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
  /** Quem responde pelo centro, com recorte (os nomes); a Controladoria (os sem recorte) em `controladoria`. */
  responsaveis: string[];
  controladoria: boolean;
  souResponsavel: boolean;
};

/** O departamento do recorte (o da gestão): o do centro de custo e o da linha da DRE da conta. */
export type DepartamentoDoRecorte = "PRODUCAO" | "SERVICOS" | "LOGISTICA" | "TECNICO" | "COMERCIAL" | "ADMINISTRATIVO" | "EXTRA_OPERACIONAL";
export type CentroOpcao = { id: string; codigoRM: string | null; nomeRM: string; departamento: string | null; departamentoDoRecorte: DepartamentoDoRecorte };
export type ContaOpcao = { id: string; reduzido: string; descricao: string; departamento: string | null; atribuicao: string | null; departamentoDoRecorte: DepartamentoDoRecorte | null };

export const ROTULO_DEPARTAMENTO: Record<DepartamentoDoRecorte, string> = {
  PRODUCAO: "Produção",
  SERVICOS: "Serviços",
  LOGISTICA: "Logística",
  TECNICO: "Técnico",
  COMERCIAL: "Comercial",
  ADMINISTRATIVO: "Administrativo",
  EXTRA_OPERACIONAL: "Extra-Operacional",
};

/** As anteriores ou as posteriores de um movimento: quantos movimentos, o valor e cada competência. */
export type ResumoDaCombinacao = { movimentos: number; valor: string; competencias: Array<{ competencia: string; movimentos: number; valor: string }> };
export type PreviaDaContestacao = {
  departamentoDoCentro: DepartamentoDoRecorte | null;
  semFornecedor: boolean;
  valor: string;
  anteriores: ResumoDaCombinacao;
  posteriores: ResumoDaCombinacao;
  emAndamento: number;
  foraDoAcesso: number;
};

/**
 * A conta cabe no centro (30/10/2026): a do departamento do centro ou a do Extra-Operacional; o centro sem departamento
 * não restringe. A mesma regra do backend (contaCabeNoCentro).
 */
export const contaCabeNoCentro = (departamentoDoCentro: DepartamentoDoRecorte | null, departamentoDaConta: DepartamentoDoRecorte | null) =>
  !departamentoDoCentro || departamentoDaConta === departamentoDoCentro || departamentoDaConta === "EXTRA_OPERACIONAL";

/** Quem responde, para as telas: "Maiko Arcaro, Marcelo Rech e a Controladoria". */
export function quemResponde(c: Pick<Contestacao, "responsaveis" | "controladoria">) {
  const partes = [...c.responsaveis, ...(c.controladoria ? ["a Controladoria"] : [])];
  if (!partes.length) return "ninguém (nenhum usuário responde pelo centro)";
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0];
}

export const ROTULO_SITUACAO: Record<SituacaoContestacao, string> = { PENDENTE: "Pendente", ACATADA: "Acatada", RECUSADA: "Recusada", VALIDADA: "Validada" };

export function mensagemDeErro(e: unknown, padrao: string) {
  const r = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return r || padrao;
}

export const contestacoesService = {
  opcoes: async (): Promise<{ centros: CentroOpcao[]; contas: ContaOpcao[] }> => (await api.get("/proxy/contestacoes/opcoes")).data.data,
  previa: async (d: { lancamentoId: string; centroNovoId: string | null; contaNovaId: string | null }): Promise<PreviaDaContestacao> =>
    (await api.get("/proxy/contestacoes/previa", { params: { lancamentoId: d.lancamentoId, centroNovoId: d.centroNovoId ?? "", contaNovaId: d.contaNovaId ?? "" } })).data.data,
  criar: async (d: {
    lancamentoId: string;
    centroNovoId: string | null;
    contaNovaId: string | null;
    motivo: string | null;
    anteriores: boolean;
    posteriores: boolean;
  }): Promise<Contestacao> => (await api.post("/proxy/contestacoes", d)).data.data,
  listar: async (aba: "solicitadas" | "recebidas" | "validacoes"): Promise<Contestacao[]> => (await api.get(`/proxy/contestacoes/${aba}`)).data.data,
  responder: async (id: string, d: { acatar: boolean; justificativa: string | null }): Promise<Contestacao> => (await api.post(`/proxy/contestacoes/${id}/responder`, d)).data.data,
  alterarSituacao: async (id: string, d: { situacao: SituacaoContestacao; justificativa: string }): Promise<Contestacao> => (await api.post(`/proxy/contestacoes/${id}/situacao`, d)).data.data,
  processar: async (): Promise<{ validadas: number; movimentos: number; paraLancamentos: number; reclassificadas: string[]; reapurar: string[] }> =>
    (await api.post("/proxy/contestacoes/processar")).data.data,
  paraLancamentos: async (anoMes: string): Promise<Contestacao[]> => (await api.get(`/proxy/competencias/${anoMes}/contestacoes/pendentes`)).data.data,
  importar: async (anoMes: string, ids: string[]): Promise<{ importadas: number; recusadas: Array<{ numero: number; motivo: string }> }> =>
    (await api.post(`/proxy/competencias/${anoMes}/contestacoes/importar`, { ids })).data.data,
  desfazerImportacao: async (id: string): Promise<void> => {
    await api.delete(`/proxy/contestacoes/${id}/importacao`);
  },
};
