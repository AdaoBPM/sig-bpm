import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

/** As oito listas que alimentam os rateios, na ordem da aba Totais. */
export const LISTAS = [
  { tipo: "PROJETO", slug: "projeto" },
  { tipo: "PRODUCAO", slug: "producao" },
  { tipo: "PRODUCAO_PISTA", slug: "producao-pista" },
  { tipo: "PRODUCAO_METALURGIA", slug: "producao-metalurgia" },
  { tipo: "PRODUCAO_ARMADURA", slug: "producao-armadura" },
  { tipo: "EXPEDICAO", slug: "expedicao" },
  { tipo: "MONTAGEM", slug: "montagem" },
  { tipo: "ACOMPANHAMENTO", slug: "acompanhamento" },
] as const;

export type TipoLista = (typeof LISTAS)[number]["tipo"];

export type CampoDigitacao = {
  coluna: string;
  rotulo: string;
  tipo: "texto" | "numero" | "opcoes";
  obrigatorio: boolean;
  opcoes?: Array<{ valor: string; rotulo: string }>;
  ajuda?: string;
};

export type DefinicoesListas = Record<TipoLista, { rotulo: string; campos: CampoDigitacao[] }>;

export type RegistroLista = {
  id: string;
  origem: "IMPORTADA" | "DIGITADA";
  linhaArquivo: number | null;
  obra: { codigo: string; nome: string } | null;
  unidade: string | null;
  linha: string | null;
  quantidade: string;
  detalhes: Array<{ rotulo: string; valor: string | null }>;
  /** Valores do formulário; só nos registros digitados. */
  valores: Record<string, string | null> | null;
};

export type PaginaLista = {
  competencia: { id: string; ano: number; mes: number; status: StatusCompetencia };
  itens: RegistroLista[];
  total: number;
  pagina: number;
  porPagina: number;
  totais: Array<{ codigo: string; rotulo: string; medida: string; quantidade: string }>;
};

const base = (anoMes: string, slug: string) => `/proxy/competencias/${anoMes}/listas/${slug}`;

export const listasService = {
  campos: async (): Promise<DefinicoesListas> => {
    const { data } = await api.get<{ data: DefinicoesListas }>("/proxy/listas/campos");
    return data.data;
  },
  listar: async (anoMes: string, slug: string, p: { busca?: string; pagina: number; porPagina: number }) => {
    const { data } = await api.get<{ data: PaginaLista }>(base(anoMes, slug), { params: p });
    return data.data;
  },
  criar: async (anoMes: string, slug: string, valores: Record<string, string>) => {
    await api.post(base(anoMes, slug), { valores });
  },
  atualizar: async (anoMes: string, slug: string, id: string, valores: Record<string, string>) => {
    await api.put(`${base(anoMes, slug)}/${id}`, { valores });
  },
  excluir: async (anoMes: string, slug: string, id: string) => {
    await api.delete(`${base(anoMes, slug)}/${id}`);
  },
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
