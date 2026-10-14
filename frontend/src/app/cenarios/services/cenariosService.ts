import { api } from "@/lib/api";

import type { Indicador, MesRelatorio, Painel, Resultados } from "@/app/relatorios/services/relatoriosService";

export type MarcacaoCenario = "ORCAMENTO_EMPRESARIAL" | "RESULTADOS_ANTERIORES" | "RESULTADOS_VENDIDOS";

export const MARCACOES: Array<{ valor: MarcacaoCenario; rotulo: string }> = [
  { valor: "ORCAMENTO_EMPRESARIAL", rotulo: "Orçamento Empresarial" },
  { valor: "RESULTADOS_ANTERIORES", rotulo: "Resultados Anteriores" },
  { valor: "RESULTADOS_VENDIDOS", rotulo: "Resultados Vendidos" },
];
export const rotuloMarcacao = (m: MarcacaoCenario | null) => MARCACOES.find((x) => x.valor === m)?.rotulo ?? null;
/** O rótulo da versão do cenário (13/10/2026): VER00, VER01… */
export const rotuloVersao = (v: number) => `VER${String(v).padStart(2, "0")}`;
/** O cenário nas listas de escolha (13/10/2026): "Exercício - Nome - Versão - Marcação" (a marcação, quando há). */
export const rotuloDoCenario = (c: Pick<Cenario, "ano" | "nome" | "versao" | "marcacao">) =>
  [String(c.ano), c.nome, rotuloVersao(c.versao), rotuloMarcacao(c.marcacao)].filter(Boolean).join(" - ");

/** Particular: só quem criou e os Administradores (o perfil Administrador); Pública: todos com permissão na lista do cenário (11/10/2026). */
export type Visualizacao = "PARTICULAR" | "PUBLICA";

/**
 * O tipo do cenário (13/10/2026): os sintéticos (a DRE importada ou digitada) e os analíticos (a DRE calculada a partir
 * das premissas), em listas separadas, cada uma com a sua permissão; as telas de um cenário são as mesmas nos dois.
 */
export type TipoCenario = "SINTETICO" | "ANALITICO";

/** Uma linha das premissas de um cenário analítico (13/10/2026): uma premissa (digitada) ou um cálculo. */
export type LinhaDaPremissa = {
  chave: string;
  secao: string;
  grupo: string | null;
  rotulo: string;
  und: string;
  tipo: "PREMISSA" | "CALCULO";
  casas: number;
  /** A Média de Referência (a média realizada da referência do cenário). */
  referencia: number | null;
  valores: Array<number | null>;
  /** Os meses com a premissa gravada; os demais valem o padrão. */
  gravados: boolean[];
};
export type TabelaDePremissas = { venda: "GLOBAL" | "MERCANTIL"; titulo: string; linhas: LinhaDaPremissa[] };
/**
 * Um grupo de centros de custo no cenário analítico (13/10/2026): o grupo da Controladoria, os centros, o balde (o mais
 * comum; `baldes` com mais de um dá o aviso), o grupo da DRE das contas, o destino do valor e o total do exercício.
 */
export type GrupoDeCentros = {
  grupo: string;
  centros: Array<{ codigo: string | null; nome: string; balde: string | null }>;
  balde: string | null;
  baldes: string[];
  grupoDRE: string;
  unidade: 1 | 2;
  destino: string;
  total: number;
};
/** Uma correspondência tarefa × linha (14/10/2026): a filial (nula: qualquer), a tarefa e o código da linha. */
/** Uma conta com movimentações do realizado fora dos padrões das premissas (14/10/2026). */
export type MovimentacaoForaDoPadrao = {
  chave: string;
  conta: { reduzido: string; descricao: string };
  /** A alocação na DRE: o departamento, a atribuição e a conta de resultado. */
  linha: { codigo: string; departamento: string; atribuicao: string; descricao: string };
  origens: string[];
  /** O total movimentado no período da carga. */
  total: number;
  valores: number[];
  /** Os grupos de centros que podem recebê-la. */
  destinos: Array<{ grupo: string; conta: string; departamento: string }>;
  /** A filial predominante dos lançamentos. */
  filial?: number;
  /** O grupo do padrão (Aplicar Padrão), quando ele pode recebê-la; ausente nas cargas antigas. */
  padrao?: string | null;
};
export type Realocacoes = {
  referencia: string | null;
  movimentacoes: MovimentacaoForaDoPadrao[];
  /** O grupo de centros escolhido para cada conta (nulo: fora do cenário); valem nas próximas cargas. */
  decisoes: Record<string, string | null>;
  aplicadas: Record<string, { grupo: string; conta: string; valores: number[] }>;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
};
export type CorrespondenciaDeTarefa = { filial: number | null; tarefa: string; linha: string };
export type Correspondencias = {
  itens: CorrespondenciaDeTarefa[];
  linhas: Array<{ codigo: string; nome: string; unidade: number; nomeUnidade: string }>;
  /** As linhas desativadas que ainda têm tarefas (14/10/2026). */
  inativas: Array<{ codigo: string; nome: string; nomeUnidade: string }>;
};
export type CentrosDoCenario = { ano: number; meses: Array<{ mes: number; rotulo: string }>; editavel: boolean; grupos: GrupoDeCentros[] };
export type ContasDoCentro = {
  grupo: Omit<GrupoDeCentros, "total">;
  /** O quadro de lotação do grupo (14/10/2026): os colaboradores de cada mês e os quadros dos indicadores em que ele entra. */
  lotacao: { valores: number[]; gravados: boolean[]; quadro: string };
  contas: Array<{ codigo: string; descricao: string; atribuicao: string; valores: number[]; gravados: boolean[] }>;
};
export type RateiosDoCenario = {
  ano: number;
  meses: Array<{ mes: number; rotulo: string }>;
  rateios: Array<{ chave: string; destino: string; rotulo: string; base: string; bases: number[]; percentuais: number[] }>;
  /** Os valores dos grupos de rateio num mês em que a chave não tem base nas premissas (13/10/2026): ficam fora da DRE. */
  semBase: Array<{ chave: string; nome: string; mes: number; rotuloMes: string; valor: number }>;
};
/** Um investimento do cenário analítico (13/10/2026), com a depreciação mensal e o ROI (%) calculados. */
export type InvestimentoDoCenario = {
  id: string;
  unidade: 1 | 2 | 3 | 4;
  conta: string;
  descricao: string;
  ganhoPrevisto: string | null;
  receitaBrutaPrevista: number | null;
  inicio: number;
  valorTotal: number;
  valorPosUso: number;
  vidaUtil: number;
  depreciacaoMensal: number;
  roi: number | null;
};
export type DadosDoInvestimento = Pick<InvestimentoDoCenario, "unidade" | "descricao" | "ganhoPrevisto" | "receitaBrutaPrevista" | "inicio" | "valorTotal" | "valorPosUso" | "vidaUtil">;
export type InvestimentosDoCenario = {
  ano: number;
  meses: Array<{ mes: number; rotulo: string }>;
  editavel: boolean;
  contas: Array<{ unidade: 1 | 2 | 3 | 4; nomeUnidade: string; conta: string; rotulo: string }>;
  depreciacao: LinhaDaPremissa[];
  investimentos: InvestimentoDoCenario[];
};
export type ExtraDoCenario = { ano: number; meses: Array<{ mes: number; rotulo: string }>; editavel: boolean; tabelas: Array<{ unidade: 4 | 5; nome: string; linhas: LinhaDaPremissa[] }> };
export type PremissasDaUnidade = { ano: number; unidade: 1 | 2 | 3; nome: string; meses: Array<{ mes: number; rotulo: string }>; editavel: boolean; tabelas: TabelaDePremissas[] };
/**
 * O caminho, o nome e as permissões de cada tipo (14/10/2026: por tela e por aba). `area` é o prefixo das áreas das
 * telas (cenarios_resultados, cenarios_analiticos_premissas.matriz…); `ler` é a leitura do grupo (alguma tela), e
 * `editar`, a criação de cenários (a edição da Lista de Cenários).
 */
export const DO_TIPO: Record<TipoCenario, { base: string; titulo: string; area: string; ler: string; editar: string }> = {
  SINTETICO: { base: "/cenarios/sinteticos", titulo: "Cenários Sintéticos", area: "cenarios", ler: "cenarios:ler", editar: "cenarios_lista:editar" },
  ANALITICO: { base: "/cenarios/analiticos", titulo: "Cenários Analíticos", area: "cenarios_analiticos", ler: "cenarios_analiticos:ler", editar: "cenarios_analiticos_lista:editar" },
};
/** O tipo pela rota da tela. */
export const tipoDaRota = (pathname: string): TipoCenario => (pathname.startsWith("/cenarios/analiticos") ? "ANALITICO" : "SINTETICO");
export const ROTULO_VISUALIZACAO: Record<Visualizacao, string> = { PARTICULAR: "Particular", PUBLICA: "Pública" };

export type Cenario = {
  id: string;
  nome: string;
  ano: number;
  tipo: TipoCenario;
  descricao: string | null;
  marcacao: MarcacaoCenario | null;
  nomeArquivo: string | null;
  importadoEm: string | null;
  criadoPor: string | null;
  criadoPorId: string | null;
  visualizacao: Visualizacao;
  /** O cenário com que este se compara (o comparativo, 12/10/2026); com ele, a tela Justificativas aparece. */
  comparadoComId: string | null;
  /**
   * O versionamento (13/10/2026): a versão (0 = VER00), a família (o id da VER00; nulo nela), a versão de origem da
   * revisão e quando e por quem a versão foi congelada (versaoSalva*: o nome antigo, de quando o botão era Salvar Versão).
   */
  versao: number;
  familiaId: string | null;
  revisaoDeId: string | null;
  versaoSalvaEm: string | null;
  versaoSalvaPor: string | null;
  /** A versão mais alta da família (13/10/2026: o filtro Apenas Vigentes). */
  vigente: boolean;
  /** Com mais de uma versão na família, o nome não muda (é o mesmo em todas). */
  nomeTravado: boolean;
  /** Quem criou o cenário e os Administradores mudam a visualização. */
  podeMudarVisualizacao: boolean;
  /** As movimentações fora dos padrões da última carga do realizado e as realocações delas (analíticos, 14/10/2026). */
  realocacoes: Realocacoes | null;
  criadoEm: string;
  /** As visões da DRE com valor (0 Consolidado, 1 a 5 as unidades). */
  visoes: number[];
  /** Os indicadores com meta. */
  indicadores: number;
  /** O total do exercício no Consolidado (a coluna Resultados da lista, 13/10/2026): o valor e o % como na tela Resultados; null sem DRE. */
  resultados: Record<"rol" | "cpv" | "ebitda" | "rl", { valor: number; pct: number | null }> | null;
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
  /** Os cenários que se podem escolher; `vigente`: a versão mais recente da família (13/10/2026). */
  /** Os cenários dos dois tipos (13/10/2026): o tipo vai numa etiqueta. */
  opcoes: Array<{ id: string; nome: string; ano: number; tipo: TipoCenario; marcacao: MarcacaoCenario | null; versao: number; vigente: boolean }>;
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
/** `comparado`: o cenário comparado (13/10/2026), cujo acumulado vem em `totalOrcado` de cada indicador. */
export type IndicadoresDoCenario = { ano: number; ate: number; meses: MesRelatorio[]; indicadores: IndicadorDoCenario[]; comparado?: { nome: string; ano: number } | null };

export const cenariosService = {
  centros: async (id: string) => (await api.get<{ data: CentrosDoCenario }>(`/proxy/cenarios/${id}/centros`)).data.data,
  centro: async (id: string, grupo: string) => (await api.get<{ data: ContasDoCentro }>(`/proxy/cenarios/${id}/centros/contas`, { params: { grupo } })).data.data,
  gravarLotacao: async (id: string, grupo: string, alteracoes: Array<{ mes: number; valor: number | null }>, origem?: OrigemDaGravacao) =>
    (await api.put<{ data: { alteradas: number; meses: number[] } }>(`/proxy/cenarios/${id}/centros/lotacao`, { grupo, alteracoes, origem })).data.data,
  gravarCentro: async (id: string, grupo: string, alteracoes: Array<{ linha: string; mes: number; valor: number | null }>, origem?: OrigemDaGravacao) =>
    (await api.put<{ data: { alteradas: number; meses: number[] } }>(`/proxy/cenarios/${id}/centros`, { grupo, alteracoes, origem })).data.data,
  investimentos: async (id: string) => (await api.get<{ data: InvestimentosDoCenario }>(`/proxy/cenarios/${id}/investimentos`)).data.data,
  criarInvestimento: async (id: string, dados: DadosDoInvestimento) => (await api.post<{ data: InvestimentosDoCenario }>(`/proxy/cenarios/${id}/investimentos`, dados)).data.data,
  alterarInvestimento: async (id: string, investimentoId: string, dados: DadosDoInvestimento) =>
    (await api.put<{ data: InvestimentosDoCenario }>(`/proxy/cenarios/${id}/investimentos/${investimentoId}`, dados)).data.data,
  excluirInvestimento: async (id: string, investimentoId: string) => (await api.delete<{ data: InvestimentosDoCenario }>(`/proxy/cenarios/${id}/investimentos/${investimentoId}`)).data.data,
  extraOperacional: async (id: string) => (await api.get<{ data: ExtraDoCenario }>(`/proxy/cenarios/${id}/extra-operacional`)).data.data,
  gravarMensais: async (id: string, tipo: "BASE" | "EXTRA", alteracoes: Array<{ linha: string; mes: number; valor: number | null }>, origem?: OrigemDaGravacao) =>
    (await api.put<{ data: { alteradas: number; meses: number[] } }>(`/proxy/cenarios/${id}/mensais`, { tipo, alteracoes, origem })).data.data,
  rateios: async (id: string) => (await api.get<{ data: RateiosDoCenario }>(`/proxy/cenarios/${id}/rateios`)).data.data,
  premissas: async (id: string, unidade: 1 | 2 | 3) => (await api.get<{ data: PremissasDaUnidade }>(`/proxy/cenarios/${id}/premissas`, { params: { unidade } })).data.data,
  gravarPremissas: async (id: string, unidade: 1 | 2 | 3, alteracoes: Array<{ venda: "GLOBAL" | "MERCANTIL"; chave: string; mes: number; valor: number | null }>, origem?: OrigemDaGravacao) =>
    (await api.put<{ data: { alteradas: number; meses: number[] } }>(`/proxy/cenarios/${id}/premissas`, { unidade, alteracoes, origem })).data.data,
  listar: async (tipo: TipoCenario = "SINTETICO") => (await api.get<{ data: Cenario[] }>("/proxy/cenarios", { params: { tipo } })).data.data,
  obter: async (id: string) => (await api.get<{ data: Cenario }>(`/proxy/cenarios/${id}`)).data.data,
  criar: async (dados: { nome: string; ano: number; descricao: string | null; copiarDe: string | null; visualizacao: Visualizacao; tipo: TipoCenario }) => (await api.post<{ data: Cenario }>("/proxy/cenarios", dados)).data.data,
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
  /** No analítico (14/10/2026), com os avisos do que não coube nas premissas. */
  referenciaRealizado: async (id: string, ano: number, opcoes: { modo: "MES_A_MES" | "MEDIA"; de?: number; ate?: number } = { modo: "MES_A_MES" }) =>
    (await api.post<{ data: Cenario & { avisos?: string[] } }>(`/proxy/cenarios/${id}/referencia/realizado`, { ano, ...opcoes })).data.data,
  /** A referência de um analítico por outro analítico (14/10/2026). */
  referenciaCenario: async (id: string, origemId: string) => (await api.post<{ data: Cenario }>(`/proxy/cenarios/${id}/referencia/cenario`, { origemId })).data.data,
  /** A correspondência tarefa × linha (14/10/2026), nos Cadastros da Controladoria / Linhas. */
  correspondencias: async () => (await api.get<{ data: Correspondencias }>("/proxy/cadastros/linhas/correspondencias")).data.data,
  gravarCorrespondencias: async (itens: CorrespondenciaDeTarefa[]) => (await api.put<{ data: Correspondencias }>("/proxy/cadastros/linhas/correspondencias", { itens })).data.data,
  resultados: async (id: string, visao: number) => (await api.get<{ data: Resultados }>(`/proxy/cenarios/${id}/resultados`, { params: { visao } })).data.data,
  /** O Painel de Bordo do cenário no mês `ate` (1 a 12): o cenário × o comparado. */
  painel: async (id: string, ate: number) =>
    (await api.get<{ data: Painel & { comparado: { nome: string; ano: number } | null } }>(`/proxy/cenarios/${id}/painel`, { params: { ate } })).data.data,
  indicadores: async (id: string) => (await api.get<{ data: IndicadoresDoCenario }>(`/proxy/cenarios/${id}/indicadores`)).data.data,
  /** Congelar Versão: trava o cenário. */
  congelarVersao: async (id: string) => (await api.post<{ data: Cenario }>(`/proxy/cenarios/${id}/versao`)).data.data,
  /** Reabrir Versão: destrava a versão congelada. */
  reabrirVersao: async (id: string) => (await api.post<{ data: Cenario }>(`/proxy/cenarios/${id}/versao/reabrir`)).data.data,
  /** Criar Revisão: a cópia da versão congelada numa versão nova, aberta para edição (devolve o cenário novo). */
  criarRevisao: async (id: string) => (await api.post<{ data: Cenario }>(`/proxy/cenarios/${id}/revisao`)).data.data,
  comparativo: async (id: string) => (await api.get<{ data: Comparativo }>(`/proxy/cenarios/${id}/comparativo`)).data.data,
  gravarComparativo: async (id: string, dados: { comparadoComId: string | null; limites: Record<string, number | null> }) =>
    (await api.put<{ data: Comparativo }>(`/proxy/cenarios/${id}/comparativo`, dados)).data.data,
  /** Grava as realocações das movimentações fora dos padrões (o grupo de cada conta, ou nulo). */
  gravarRealocacoes: async (id: string, decisoes: Record<string, string | null>) =>
    (await api.put<{ data: Cenario }>(`/proxy/cenarios/${id}/realocacoes`, { decisoes })).data.data,
  justificativas: async (id: string) => (await api.get<{ data: Justificativas }>(`/proxy/cenarios/${id}/justificativas`)).data.data,
  /** Grava a justificativa de uma linha numa visão; o texto vazio a apaga. */
  gravarJustificativa: async (id: string, visao: number, linha: string, texto: string) => {
    await api.put(`/proxy/cenarios/${id}/justificativas`, { visao, linha, texto });
  },
  salvarManual: async (id: string, nome: string, valores: Array<number | null>) => {
    await api.put(`/proxy/cenarios/${id}/indicadores/manuais`, { nome, valores });
  },
};
