import { api } from "@/lib/api";

import type { Indicadores, Painel } from "@/app/relatorios/services/relatoriosService";

/** Os Relatórios Executivos (15/10/2026, Análises Gerenciais): as apresentações mensais dos gestores. */
export type Departamento = { chave: string; nome: string };
export type Situacao = "EM_ELABORACAO" | "FINALIZADO";
export type ResumoDoRelatorio = {
  id: string;
  ano: number;
  mes: number;
  rotuloMes: string;
  autorNome: string;
  departamentos: Departamento[];
  situacao: Situacao;
  finalizadoEm: string | null;
  atualizadoEm: string;
  meu: boolean;
};
export type ListaDeRelatorios = {
  anos: number[];
  ano: number;
  meusDepartamentos: Departamento[] | null;
  departamentos: Departamento[];
  meses: Array<{ mes: number; rotulo: string; relatorios: ResumoDoRelatorio[]; temMeu: boolean }>;
};

/** Um bloco da grade: a posição e o tamanho (colunas e linhas) e o conteúdo. */
export type Posicao = { id: string; x: number; y: number; w: number; h: number };
export type Nota = "POSITIVO" | "NEGATIVO" | "ATENCAO";
export type Bloco = Posicao &
  (
    | { tipo: "PAINEL"; aba: "resultados" | "performance"; quadro: string; titulo: string; sigla: string; comGrafico: boolean }
    | { tipo: "INDICADOR"; nome: string }
    | { tipo: "ANOTACAO"; nota: Nota; texto: string }
  );
/** O conteúdo de um bloco, sem a posição (um bloco novo, antes de entrar na grade). */
export type ConteudoDoBloco = Bloco extends infer B ? (B extends Bloco ? Omit<B, keyof Posicao> : never) : never;
export type Blocos = Record<string, Bloco[]>;
export type Relatorio = ResumoDoRelatorio & { blocos: Blocos; podeEditar: boolean; podeReabrir: boolean };
export type DadosDoRelatorio = { painel: Painel; indicadores: Indicadores };

const base = "/proxy/relatorios-executivos";
export const relatoriosExecutivosService = {
  listar: async (ano: number | null) => (await api.get<{ data: ListaDeRelatorios }>(base, { params: ano ? { ano } : {} })).data.data,
  criar: async (ano: number, mes: number, departamentos: string[] | null) => (await api.post<{ data: ResumoDoRelatorio }>(base, { ano, mes, departamentos })).data.data,
  obter: async (id: string) => (await api.get<{ data: Relatorio }>(`${base}/${id}`)).data.data,
  dados: async (id: string) => (await api.get<{ data: DadosDoRelatorio }>(`${base}/${id}/dados`)).data.data,
  gravar: async (id: string, blocos: Blocos) => (await api.put<{ data: Relatorio }>(`${base}/${id}`, { blocos })).data.data,
  finalizar: async (id: string) => (await api.post<{ data: Relatorio }>(`${base}/${id}/finalizar`)).data.data,
  reabrir: async (id: string) => (await api.post<{ data: Relatorio }>(`${base}/${id}/reabrir`)).data.data,
  excluir: async (id: string) => (await api.delete<{ data: { excluido: boolean } }>(`${base}/${id}`)).data.data,
};
