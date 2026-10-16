import { api } from "@/lib/api";

import type { Indicadores, Painel } from "@/app/relatorios/services/relatoriosService";

/**
 * Os Relatórios Executivos (15/10/2026, Análises Gerenciais): um relatório por competência fechada, com uma aba por
 * departamento; cada gestor edita as abas do seu recorte, e cada aba tem a sua situação.
 */
export type Situacao = "EM_ELABORACAO" | "FINALIZADO";
export type AbaResumida = { chave: string; nome: string; situacao: Situacao };
export type ResumoDoRelatorio = {
  id: string;
  ano: number;
  mes: number;
  rotuloMes: string;
  situacao: Situacao;
  finalizadas: number;
  total: number;
  /** As abas que o usuário edita, com a situação de cada uma. */
  minhas: AbaResumida[];
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
};
export type ListaDeRelatorios = {
  relatorios: ResumoDoRelatorio[];
  /** As competências fechadas ainda sem relatório. */
  livres: Array<{ ano: number; mes: number; rotulo: string }>;
  meusDepartamentos: Array<{ chave: string; nome: string }>;
};

/** Um bloco da grade: a posição e o tamanho (colunas e linhas) e o conteúdo. */
export type Posicao = { id: string; x: number; y: number; w: number; h: number };
export type Nota = "POSITIVO" | "NEGATIVO" | "ATENCAO";
export type Bloco = Posicao &
  (
    | {
        tipo: "PAINEL";
        aba: "resultados" | "performance";
        quadro: string;
        titulo: string;
        sigla: string;
        comGrafico: boolean;
        /** As opções do gráfico do card (16/10/2026), como no Configurar Gráficos do Painel; sem elas, as do navegador. */
        tipoGrafico?: "barras" | "area";
        comRotulos?: boolean;
        cores?: "padrao" | "daltonismo";
      }
    | { tipo: "INDICADOR"; nome: string }
    /** O título da anotação (16/10/2026); sem ele, o nome da nota. */
    | { tipo: "ANOTACAO"; nota: Nota; texto: string; titulo?: string }
    /** Uma foto (16/10/2026): o arquivo, guardado no servidor, a legenda e a proporção (largura ÷ altura). */
    | { tipo: "FOTO"; arquivo: string; legenda: string; proporcao: number }
  );
/** O conteúdo de um bloco, sem a posição (um bloco novo, antes de entrar na grade). */
export type ConteudoDoBloco = Bloco extends infer B ? (B extends Bloco ? Omit<B, keyof Posicao> : never) : never;
export type AbaDoRelatorio = AbaResumida & {
  /** Em elaboração, só quem a edita (e o Administrador) a vê. */
  visivel: boolean;
  blocos: Bloco[];
  podeEditar: boolean;
  podeReabrir: boolean;
  atualizadoPor: string | null;
  atualizadoEm: string;
  finalizadoPor: string | null;
  finalizadoEm: string | null;
};
export type Relatorio = {
  id: string;
  ano: number;
  mes: number;
  rotuloMes: string;
  situacao: Situacao;
  criadoPor: string;
  criadoEm: string;
  abas: AbaDoRelatorio[];
  podeExcluir: boolean;
};
export type DadosDoRelatorio = { painel: Painel; indicadores: Indicadores };

const base = "/proxy/relatorios-executivos";
export const relatoriosExecutivosService = {
  listar: async () => (await api.get<{ data: ListaDeRelatorios }>(base)).data.data,
  /** Com `importarDe` (16/10/2026), as abas começam com os blocos (cards, fotos e anotações) daquele relatório. */
  criar: async (ano: number, mes: number, importarDe: string | null) => (await api.post<{ data: { id: string; rotuloMes: string } }>(base, { ano, mes, importarDe })).data.data,
  obter: async (id: string) => (await api.get<{ data: Relatorio }>(`${base}/${id}`)).data.data,
  dados: async (id: string) => (await api.get<{ data: DadosDoRelatorio }>(`${base}/${id}/dados`)).data.data,
  gravarAba: async (id: string, aba: string, blocos: Bloco[]) => (await api.put<{ data: Relatorio }>(`${base}/${id}/abas/${aba}`, { blocos })).data.data,
  finalizarAba: async (id: string, aba: string) => (await api.post<{ data: Relatorio }>(`${base}/${id}/abas/${aba}/finalizar`)).data.data,
  reabrirAba: async (id: string, aba: string) => (await api.post<{ data: Relatorio }>(`${base}/${id}/abas/${aba}/reabrir`)).data.data,
  enviarFoto: async (id: string, foto: Blob) =>
    (await api.post<{ data: { arquivo: string } }>(`${base}/${id}/fotos`, foto, { headers: { "Content-Type": foto.type } })).data.data,
  excluir: async (id: string) => (await api.delete<{ data: { excluido: boolean } }>(`${base}/${id}`)).data.data,
};

/** O endereço de uma foto do relatório (pelo proxy, com o login). */
export const enderecoDaFoto = (id: string, arquivo: string) => `/api${base}/${id}/fotos/${arquivo}`;
