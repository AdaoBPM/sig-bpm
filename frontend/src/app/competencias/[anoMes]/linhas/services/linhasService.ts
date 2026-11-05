import { api } from "@/lib/api";

import type { LinhasResultados, ResultadosDaLinha } from "@/app/relatorios/services/relatoriosService";

import type { StatusCompetencia } from "../../../services/competenciasService";

/** A etapa Linhas (26/10/2026): a DRE de cada unidade dividida entre as linhas, gravada na apuração. */
export type LinhasDoMes = {
  /** `obrasGravadasEm` (03/11/2026, o Realizado por Obra): quando a etapa gravou as obras; nula, a competência foi gravada antes. */
  situacao: { status: StatusCompetencia; apurada: boolean; gravadaEm: string | null; obrasGravadasEm: string | null; podeGravar: boolean };
  unidades: Array<{ unidade: number; nome: string; mcDaDRE: number; mcDasLinhas: number; semLinha: number }>;
  /** De que passo da Alocação nas Linhas veio cada valor: Matriz, Filial e Serviços. */
  niveis: Array<{ nivel: string; rotulo: string; porUnidade: number[] }>;
  documentos: { requisicoes: number; notas: number } | null;
  avisos: string[];
  /** As obras de cada linha (03/11/2026): quantas, o custo que ficou Sem Obra e os avisos. */
  obras: { gravadasEm: string; obras: number; semObra: number; avisos: string[] } | null;
  linhas: Array<{ id: string; codigo: string; nome: string; unidade: number; nomeUnidade: string; ativo: boolean; receitaLiquida: number | null; mc: number | null }>;
};

export const linhasService = {
  doMes: async (anoMes: string) => (await api.get<{ data: LinhasDoMes }>(`/proxy/competencias/${anoMes}/linhas`)).data.data,
  /** As linhas do mês (27/10/2026), para a lista, como na aba Linhas dos Resultados Empresariais. */
  lista: async (anoMes: string) => (await api.get<{ data: LinhasResultados }>(`/proxy/competencias/${anoMes}/linhas/lista`)).data.data,
  /** A DRE de uma linha no mês, da receita à Margem de Contribuição. */
  linha: async (anoMes: string, id: string) => (await api.get<{ data: ResultadosDaLinha }>(`/proxy/competencias/${anoMes}/linhas/linha/${id}`)).data.data,
  /** Grava as linhas e as obras de uma competência fechada antes da etapa Linhas (com as linhas gravadas, só as obras). */
  gravar: async (anoMes: string) => (await api.post<{ data: LinhasDoMes }>(`/proxy/competencias/${anoMes}/linhas/gravar`)).data.data,
};
