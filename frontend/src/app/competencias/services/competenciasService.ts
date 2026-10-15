import { api } from "@/lib/api";

export type StatusCompetencia = "ABERTA" | "EM_CONFERENCIA" | "FECHADA";

export type Competencia = {
  id: string;
  ano: number;
  mes: number;
  nomeMes: string;
  status: StatusCompetencia;
  abertaEm: string;
  apuradaEm: string | null;
  apuracoes: number;
  /** Recebeu dados importados a partir de outro mês (lote) e ainda não foi apurado depois: bola verde. */
  dadosNovos: boolean;
  /** Nas competências em andamento, as chaves de rateio sem regra vigente no mês (14/10/2026). */
  rateiosSemVigencia?: string[];
  fechadaEm: string | null;
  usuarioAbertura: { nome: string } | null;
  usuarioApuracao: { nome: string } | null;
  usuarioFechamento: { nome: string } | null;
  _count: {
    importacoes: number;
    divergencias: number;
    historicoReaberturas: number;
  };
  /** Só quando pedido (tela de competências): o andamento das etapas do mês. */
  andamento?: {
    balancete: boolean;
    lancamentos: number;
    pendencias: number;
    semClassificacao: number;
    desatualizada: boolean;
  };
};

export type ListaCompetencias = {
  itens: Competencia[];
  anos: number[];
};

export const competenciasService = {
  listar: async (ano?: number, andamento = false): Promise<ListaCompetencias> => {
    const { data } = await api.get<{ data: ListaCompetencias }>(
      "/proxy/competencias",
      { params: { ...(ano ? { ano } : {}), ...(andamento ? { andamento: 1 } : {}) } },
    );
    return data.data;
  },

  abrir: async (ano: number, mes: number): Promise<Competencia> => {
    const { data } = await api.post<{ data: Competencia }>(
      "/proxy/competencias",
      { ano, mes },
    );
    return data.data;
  },
};
