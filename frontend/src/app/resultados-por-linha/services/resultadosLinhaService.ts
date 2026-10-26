import { api } from "@/lib/api";

import type { LinhaResultado, MesRelatorio } from "@/app/relatorios/services/relatoriosService";

/** Os Resultados por Linha (26/10/2026): o exercício até um mês, os documentos de cada mês e a importação deles. */
const base = "/proxy/resultados-por-linha";

export type Origem = { nivel: string; rotulo: string; meses: Array<number | null> };
export type CustoRateado = {
  /** A base da linha: "m³ produzido" (Matriz e Filial) ou "dias de acompanhamento" (Serviços). */
  base: string;
  meses: Array<{ custo: number | null; base: number | null; unitario: number | null }>;
  total: { custo: number; base: number; unitario: number | null };
};
export type LinhaDoNegocio = {
  id: string;
  codigo: string;
  nome: string;
  unidade: number;
  nomeUnidade: string;
  ativo: boolean;
  resultado: LinhaResultado[];
  rateios: LinhaResultado[];
  custoRateado: CustoRateado;
  origem: Origem[];
};
export type ResultadosPorLinha = {
  ano: number;
  ate: number;
  meses: Array<MesRelatorio & { fechada: boolean }>;
  linhas: LinhaDoNegocio[];
  conferencia: {
    unidades: Array<{
      unidade: number;
      nome: string;
      meses: Array<{ mcDaDRE: number; mcDasLinhas: number; semLinha: number } | null>;
      semLinha: LinhaResultado[];
      origemSemLinha: Origem[];
    }>;
    niveis: Array<{ nivel: string; rotulo: string; porUnidade: Array<{ unidade: number; meses: Array<number | null> }> }>;
    documentos: Array<{ mes: number; rotulo: string; requisicoes: number; notas: number }>;
    avisos: string[];
  };
};

export type ImportacaoDeDocumentos = {
  status: "PROCESSANDO" | "CONCLUIDA" | "REJEITADA";
  progresso: number;
  importadoEm: string;
  nomeArquivo: string;
  itens: number | null;
  total: number | null;
  motivo: string | null;
  usuario: string | null;
};
export type DocumentosDoMes = {
  mes: number;
  rotulo: string;
  fechada: boolean;
  requisicoes: { vigente: ImportacaoDeDocumentos | null; ultima: ImportacaoDeDocumentos | null };
  notas: { vigente: ImportacaoDeDocumentos | null; ultima: ImportacaoDeDocumentos | null };
};

export const resultadosLinhaService = {
  calcular: async (ano: number, ate: number) => (await api.get<{ data: ResultadosPorLinha }>(base, { params: { ano, ate } })).data.data,
  documentos: async (ano: number) => (await api.get<{ data: DocumentosDoMes[] }>(`${base}/documentos`, { params: { ano } })).data.data,
  /** Envia o LISTAS REALIZADO (RESULTADOS) de um mês: as abas Requisições (Lista) e Notas Fiscais (Lista) entram na fila. */
  importar: async (anoMes: string, arquivo: File, onProgresso?: (percentual: number) => void) =>
    (
      await api.post(`${base}/documentos/${anoMes}`, arquivo, {
        params: { nomeArquivo: arquivo.name },
        headers: { "Content-Type": "application/octet-stream" },
        onUploadProgress: (e) => {
          if (e.total) onProgresso?.(Math.round((e.loaded / e.total) * 100));
        },
      })
    ).data,
};
