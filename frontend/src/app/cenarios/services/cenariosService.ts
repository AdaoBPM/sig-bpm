import { api } from "@/lib/api";

import type { Indicador, MesRelatorio, Resultados } from "@/app/relatorios/services/relatoriosService";

export type MarcacaoCenario = "ORCAMENTO_EMPRESARIAL" | "RESULTADOS_ANTERIORES" | "RESULTADOS_VENDIDOS";

export const MARCACOES: Array<{ valor: MarcacaoCenario; rotulo: string }> = [
  { valor: "ORCAMENTO_EMPRESARIAL", rotulo: "Orçamento Empresarial" },
  { valor: "RESULTADOS_ANTERIORES", rotulo: "Resultados Anteriores" },
  { valor: "RESULTADOS_VENDIDOS", rotulo: "Resultados Vendidos" },
];
export const rotuloMarcacao = (m: MarcacaoCenario | null) => MARCACOES.find((x) => x.valor === m)?.rotulo ?? null;

/** Particular: só quem criou e o Administrador; Pública: todos com permissão nos Cenários Sintéticos (11/10/2026). */
export type Visualizacao = "PARTICULAR" | "PUBLICA";
export const ROTULO_VISUALIZACAO: Record<Visualizacao, string> = { PARTICULAR: "Particular", PUBLICA: "Pública" };

export type Cenario = {
  id: string;
  nome: string;
  ano: number;
  tipo: string;
  descricao: string | null;
  marcacao: MarcacaoCenario | null;
  nomeArquivo: string | null;
  importadoEm: string | null;
  criadoPor: string | null;
  criadoPorId: string | null;
  visualizacao: Visualizacao;
  /** O cenário com que este se compara (o comparativo, 12/10/2026); com ele, a tela Justificativas aparece. */
  comparadoComId: string | null;
  /** Quem criou o cenário e o Administrador mudam a visualização. */
  podeMudarVisualizacao: boolean;
  criadoEm: string;
  /** As visões da DRE com valor (0 Consolidado, 1 a 5 as unidades). */
  visoes: number[];
  /** Os indicadores com meta. */
  indicadores: number;
};

/** O que a tela fez numa gravação de valores (o histórico de reajustes). */
export type OrigemDaGravacao = { tipo: "MARCADOS" | "VALOR"; modo: "PERCENTUAL" | "ABSOLUTO" | "DIGITADO"; reajuste: number | null; replicado: boolean };
/** Uma linha do histórico de reajustes. */
export type ReajusteDoCenario = {
  id: string;
  criadoEm: string;
  usuarioNome: string;
  tipo: "MARCADOS" | "VALOR" | "REFERENCIA";
  modo: "PERCENTUAL" | "ABSOLUTO" | "DIGITADO" | null;
  reajuste: number | null;
  visao: number | null;
  replicado: boolean;
  /** As contas alteradas, com o departamento e a atribuição da linha delas na Estrutura da DRE. */
  contas: Array<{ codigo: string; descricao: string; departamento: string | null; atribuicao: string | null }>;
  meses: number[];
  valores: number;
  somaAntes: number | null;
  somaDepois: number | null;
  descricao: string | null;
};

/** O comparativo: o cenário comparado, os que se podem escolher e a variação máxima (%) de cada total da DRE (nula: não verifica). */
export type Comparativo = {
  comparadoCom: { id: string; nome: string; ano: number } | null;
  opcoes: Array<{ id: string; nome: string; ano: number; marcacao: MarcacaoCenario | null }>;
  totais: Array<{ codigo: string; descricao: string; limite: number | null }>;
};
/** Uma linha acima da variação máxima: os meses (o valor, o comparado e a variação em %; nula sem base) e a justificativa. */
export type ItemJustificativa = {
  codigo: string;
  descricao: string;
  total: string;
  /** O total sem contas embaixo, verificado ele mesmo. */
  ehTotal: boolean;
  limite: number;
  meses: Array<{ mes: number; valor: number; comparado: number; variacao: number | null }>;
  justificativa: { texto: string; usuarioNome: string; atualizadoEm: string } | null;
};
export type Justificativas = { comparadoCom: { id: string; nome: string; ano: number } | null; visoes: Array<{ visao: number; nome: string; itens: ItemJustificativa[] }> };

/** Quantos valores entram, mudam e saem do cenário. */
export type Mudancas = { novas: number; alteradas: number; removidas: number; semMudanca: boolean };
/** A prévia da importação: o que o arquivo traz, aba por aba, e o que muda no cenário. */
export type PreviaCenario = {
  hash: string;
  nomeArquivo: string;
  ano: number;
  cenario: { id: string; nome: string; ano: number } | null;
  /** O que impede a importação (o exercício do arquivo diferente do do cenário). */
  bloqueio: string | null;
  visoes: Array<{ visao: number; nome: string; aba: string; meses: number; linhas: number; semPar: string[]; valores: number; acao: "NOVA" | "SUBSTITUI"; mudancas: Mudancas }>;
  faltam: Array<{ nome: string; temValores: boolean }>;
  metas: { aba: string; indicadores: number; meses: number; ignorados: string[]; acao: "NOVA" | "SUBSTITUI"; mudancas: Mudancas; digitados: number } | null;
  metasAtuais: number;
  ignoradas: string[];
};

/** RESULTADO: sai da DRE do cenário; MANUAL: lançamento manual; CALCULADO: DRE e lançamentos (eficiências); IMPORTADO: da aba das metas. */
export type ClasseIndicador = "RESULTADO" | "MANUAL" | "CALCULADO" | "IMPORTADO";
export type IndicadorDoCenario = Indicador & { classe: ClasseIndicador; digitados: boolean[] };
export type IndicadoresDoCenario = { ano: number; ate: number; meses: MesRelatorio[]; indicadores: IndicadorDoCenario[] };

export const cenariosService = {
  listar: async () => (await api.get<{ data: Cenario[] }>("/proxy/cenarios")).data.data,
  obter: async (id: string) => (await api.get<{ data: Cenario }>(`/proxy/cenarios/${id}`)).data.data,
  criar: async (dados: { nome: string; ano: number; descricao: string | null; copiarDe: string | null; visualizacao: Visualizacao }) => (await api.post<{ data: Cenario }>("/proxy/cenarios", dados)).data.data,
  atualizar: async (id: string, dados: { nome: string; descricao: string | null; visualizacao: Visualizacao }) => (await api.patch<{ data: Cenario }>(`/proxy/cenarios/${id}`, dados)).data.data,
  excluir: async (id: string) => {
    await api.delete(`/proxy/cenarios/${id}`);
  },
  marcar: async (id: string, marcacao: MarcacaoCenario | null) =>
    (await api.put<{ data: { desmarcado: string | null } }>(`/proxy/cenarios/${id}/marcacao`, { marcacao })).data.data,
  /** Importação, passo 1: o arquivo vai cru no corpo; devolve a prévia (nada é gravado). */
  analisar: async (arquivo: File, cenarioId: string | null, onProgresso?: (percentual: number) => void) =>
    (
      await api.post<{ data: PreviaCenario }>("/proxy/cenarios/importar/analise", arquivo, {
        params: { nomeArquivo: arquivo.name, ...(cenarioId ? { cenarioId } : {}) },
        headers: { "Content-Type": "application/octet-stream" },
        onUploadProgress: (e) => {
          if (e.total) onProgresso?.(Math.round((e.loaded / e.total) * 100));
        },
      })
    ).data.data,
  /** Importação, passo 2: grava o que a prévia mostrou, no cenário ou num cenário novo (nome e descrição). */
  importar: async (previa: PreviaCenario, destino: { cenarioId: string } | { nome: string; ano: number; descricao: string | null; visualizacao: Visualizacao }) =>
    (
      await api.post<{ data: { cenario: Cenario; previa: PreviaCenario } }>("/proxy/cenarios/importar", {
        hash: previa.hash,
        nomeArquivo: previa.nomeArquivo,
        ...destino,
      })
    ).data.data,
  /** Uma visão da DRE para a edição: todas as linhas e os doze meses; `editaveis` são as contas que se editam. */
  edicao: async (id: string, visao: number) =>
    (await api.get<{ data: Resultados & { editaveis: string[] } }>(`/proxy/cenarios/${id}/edicao`, { params: { visao } })).data.data,
  /** Grava valores mensais de contas de uma unidade (1 a 5); os totais e o Consolidado se recalculam. */
  gravarValores: async (id: string, visao: number, alteracoes: Array<{ linha: string; mes: number; valor: number }>, origem?: OrigemDaGravacao) =>
    (await api.put<{ data: { alteradas: number; meses: number[] } }>(`/proxy/cenarios/${id}/edicao/valores`, { visao, alteracoes, origem })).data.data,
  /** O histórico de reajustes do cenário, do mais recente ao mais antigo. */
  reajustes: async (id: string) => (await api.get<{ data: ReajusteDoCenario[] }>(`/proxy/cenarios/${id}/reajustes`)).data.data,
  /** A referência pelo resultado realizado: a DRE das competências fechadas do exercício substitui a do cenário. */
  /** Mês a mês (os meses fechados) ou a média de um período (de–ate) replicada nos doze meses. */
  referenciaRealizado: async (id: string, ano: number, opcoes: { modo: "MES_A_MES" | "MEDIA"; de?: number; ate?: number } = { modo: "MES_A_MES" }) =>
    (await api.post<{ data: Cenario }>(`/proxy/cenarios/${id}/referencia/realizado`, { ano, ...opcoes })).data.data,
  resultados: async (id: string, visao: number) => (await api.get<{ data: Resultados }>(`/proxy/cenarios/${id}/resultados`, { params: { visao } })).data.data,
  indicadores: async (id: string) => (await api.get<{ data: IndicadoresDoCenario }>(`/proxy/cenarios/${id}/indicadores`)).data.data,
  comparativo: async (id: string) => (await api.get<{ data: Comparativo }>(`/proxy/cenarios/${id}/comparativo`)).data.data,
  gravarComparativo: async (id: string, dados: { comparadoComId: string | null; limites: Record<string, number | null> }) =>
    (await api.put<{ data: Comparativo }>(`/proxy/cenarios/${id}/comparativo`, dados)).data.data,
  justificativas: async (id: string) => (await api.get<{ data: Justificativas }>(`/proxy/cenarios/${id}/justificativas`)).data.data,
  /** Grava a justificativa de uma linha numa visão; o texto vazio a apaga. */
  gravarJustificativa: async (id: string, visao: number, linha: string, texto: string) => {
    await api.put(`/proxy/cenarios/${id}/justificativas`, { visao, linha, texto });
  },
  salvarManual: async (id: string, nome: string, valores: Array<number | null>) => {
    await api.put(`/proxy/cenarios/${id}/indicadores/manuais`, { nome, valores });
  },
};
