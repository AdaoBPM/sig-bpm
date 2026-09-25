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
  fechadaEm: string | null;
  usuarioAbertura: { nome: string } | null;
  usuarioApuracao: { nome: string } | null;
  usuarioFechamento: { nome: string } | null;
  _count: {
    importacoes: number;
    divergencias: number;
    historicoReaberturas: number;
  };
};

export type ListaCompetencias = {
  itens: Competencia[];
  anos: number[];
};

export const competenciasService = {
  listar: async (ano?: number): Promise<ListaCompetencias> => {
    const { data } = await api.get<{ data: ListaCompetencias }>(
      "/proxy/competencias",
      { params: ano ? { ano } : undefined },
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
