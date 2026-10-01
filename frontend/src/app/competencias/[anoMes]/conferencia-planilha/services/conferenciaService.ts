import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

export type LinhaConferencia = {
  linha: number;
  descricao: string;
  codigo: string;
  tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL";
  grupo: string;
  sistema: string | null;
  planilha: number | null;
  diferenca: number;
  destaque: boolean;
  observacao?: string;
};

export type VisaoConferencia = {
  unidade: number;
  nome: string;
  aba: string;
  comparadas: number;
  diferencas: number;
  maiorDiferenca: number;
  linhas: LinhaConferencia[];
  soNaPlanilha: Array<{ linha: number; descricao: string; planilha: number | null }>;
  soNoSistema: Array<{ codigo: string; descricao: string; sistema: string | null }>;
  /** Totais que só a planilha mostra; a DRE da ferramenta não os tem. */
  totaisDaPlanilha: Array<{ linha: number; descricao: string; planilha: number | null }>;
};

export type RelatorioConferencia = {
  competencia: { ano: number; mes: number; status: StatusCompetencia };
  apuradaEm: string | null;
  limite: number;
  envios: number;
  conferencia: { nomeArquivo: string; hashArquivo: string; enviadoEm: string; enviadoPor: string } | null;
  resumo: { comparadas: number; diferencas: number; soNaPlanilha: number; soNoSistema: number } | null;
  visoes: VisaoConferencia[];
};

export const conferenciaService = {
  relatorio: async (anoMes: string, limite: number): Promise<RelatorioConferencia> => {
    const { data } = await api.get<{ data: RelatorioConferencia }>(`/proxy/competencias/${anoMes}/conferencia-planilha`, { params: { limite } });
    return data.data;
  },
  enviar: async (anoMes: string, arquivo: File, onProgresso?: (percentual: number) => void) => {
    const { data } = await api.post<{ data: { id: string; linhas: number } }>(`/proxy/competencias/${anoMes}/conferencia-planilha`, arquivo, {
      params: { nomeArquivo: arquivo.name },
      headers: { "Content-Type": "application/octet-stream" },
      onUploadProgress: (e) => {
        if (e.total) onProgresso?.(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data.data;
  },
};

export function mensagemDeErro(error: unknown, padrao: string) {
  return (error as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
}
