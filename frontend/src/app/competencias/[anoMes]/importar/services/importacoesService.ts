import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type TipoImportacao =
  | "BALANCETE"
  | "PROJETO"
  | "PRODUCAO"
  | "PRODUCAO_PISTA"
  | "PRODUCAO_ARMADURA"
  | "PRODUCAO_METALURGIA"
  | "EXPEDICAO"
  | "MONTAGEM"
  | "ACOMPANHAMENTO";
export type StatusImportacao = "PROCESSANDO" | "CONCLUIDA" | "REJEITADA";

export type Importacao = {
  id: string;
  tipo: string;
  nomeArquivo: string;
  importadoEm: string;
  status: StatusImportacao;
  progresso: number;
  linhasLidas: number;
  linhasAceitas: number;
  linhasRejeitadas: number;
  linhasIgnoradas: number;
  motivoRejeicao: string | null;
  substituidaEm: string | null;
  /** Balancete de competência fechada: só comparado com o gravado (Passo 24). */
  comparacao: boolean;
  usuario: { nome: string } | null;
};

export type Rejeicao = {
  linha: number;
  codigo: string;
  mensagem: string;
  filial?: string;
  codigoCentroCusto?: string | null;
  reduzido?: string | null;
  valor?: string;
};

export type CentroSemCadastro = {
  codigo: string;
  nome: string | null;
  obra: boolean;
  linhas: number;
  valor: string;
};

export type ResumoBalancete = {
  aba: string;
  somaArquivo: string;
  totalGeral: string | null;
  valorAceito: string;
  valorRejeitado: string;
  ignoradas: { subtotais: number; semMovimento: number };
  porFilial: Array<{ filial: number; linhas: number; valor: string }>;
  centrosSemCadastro: CentroSemCadastro[];
  substituiu: string[];
  /** Comparação com competência fechada: quantas divergências entraram. */
  modo?: "COMPARACAO";
  divergencias?: number;
  diferenca?: string;
  /** Os outros meses fechados do arquivo, comparados com o gravado. */
  retroativas?: Array<{ competencia: string; divergencias: number; diferenca: string }>;
};

/** Resumo das listas operacionais: volumes pelas linhas da aba Totais. */
export type ResumoLista = {
  aba: string;
  lista: string;
  registros: number;
  ignoradas: { vazias: number; outrosMeses: number; semEfeito?: number };
  totais: Array<{ codigo: string; rotulo: string; medida: string; quantidade: string }>;
  /** Lista da receita prévia: os totais são por unidade, não linhas da Totais. */
  receita?: boolean;
  obrasCriadas: number;
  avisos: string[];
  substituiu: string[];
};

/** Resumo da DRE do Comercial: o que a importação fez com os preços vigentes. */
export type ResumoDreComercial = {
  aba: string;
  obras: number;
  obrasCriadas: number;
  precos: { novos: number; alterados: number; inalterados: number; removidos: number };
  alteracoes: Array<{
    obra: string;
    etapa: string | null;
    linha: string;
    conta: string;
    departamento: string | null;
    antes: { unitario: string | null; total: string | null };
    depois: { unitario: string | null; total: string | null };
  }>;
  removidosExemplos: Array<{ obra: string; etapa: string | null; linha: string; conta: string }>;
  obrasComAditivo: string[];
  obrasRepetidas: Array<{ obra: string; linhas: number }>;
  obrasSemContrato: number;
  /** foraDoFiltro: linhas da DRE que a receita prévia não usa (custos, quantidades…). */
  ignoradas?: { vazias: number; repetidas: number; foraDoFiltro: number };
};

/** Resumo do saldo inicial do estoque. */
export type ResumoEstoqueInicial = {
  aba: string;
  saldos: number;
  obrasCriadas: number;
  porLinha: Array<{ linha: string; saldos: number; volume: string; valor: string }>;
};

export type ImportacaoDetalhe = Importacao & {
  hashArquivo: string;
  relatorioErros: Rejeicao[] | null;
  /** ResumoBalancete quando tipo é BALANCETE; ResumoLista nas listas. */
  resumo: ResumoBalancete | ResumoLista | ResumoDreComercial | ResumoEstoqueInicial | null;
  competencia: { ano: number; mes: number; status: StatusCompetencia };
};

export type ImportacoesDaCompetencia = {
  competencia: { id: string; ano: number; mes: number; status: StatusCompetencia };
  itens: Importacao[];
};

/** Resposta de erro do backend: mensagem pronta e, às vezes, um código. */
export type ErroImportacao = { error?: string; codigo?: string };

export const importacoesService = {
  listar: async (anoMes: string): Promise<ImportacoesDaCompetencia> => {
    const { data } = await api.get<{ data: ImportacoesDaCompetencia }>(
      `/proxy/competencias/${anoMes}/importacoes`,
    );
    return data.data;
  },

  detalhar: async (id: string): Promise<ImportacaoDetalhe> => {
    const { data } = await api.get<{ data: ImportacaoDetalhe }>(
      `/proxy/importacoes/${id}`,
    );
    return data.data;
  },

  /** O arquivo vai cru no corpo; tipo e nome, na query. */
  enviar: async (
    anoMes: string,
    tipo: TipoImportacao,
    arquivo: File,
    forcar: boolean,
    onProgresso?: (percentual: number) => void,
  ): Promise<Importacao> => {
    const { data } = await api.post<{ data: Importacao }>(
      `/proxy/competencias/${anoMes}/importacoes`,
      arquivo,
      {
        params: { tipo, nomeArquivo: arquivo.name, forcar: forcar || undefined },
        headers: { "Content-Type": "application/octet-stream" },
        onUploadProgress: (e) => {
          if (e.total) onProgresso?.(Math.round((e.loaded / e.total) * 100));
        },
      },
    );
    return data.data;
  },
};
