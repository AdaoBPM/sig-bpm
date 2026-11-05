import { api } from "@/lib/api";

import type { StatusCompetencia } from "../../../services/competenciasService";

/**
 * Um crédito de uma conta (ou de um total): o R$ e o percentual (fração) sobre o custo da conta na unidade; o R$ nulo sem os
 * créditos importados no mês, e o percentual nulo também sem a apuração.
 */
export type Credito = { valor: number | null; pct: number | null };
/** O custo da conta na unidade (a DRE apurada; nulo sem a apuração) e o Creditado e o Estornado. */
export type CreditosDaConta = { valor: number | null; creditado: Credito; estornado: Credito };
type Grupo = { codigo: string; descricao: string; contas: Array<CreditosDaConta & { codigo: string; descricao: string }>; total: CreditosDaConta };

/**
 * Os Créditos de Impostos do mês (03/11/2026; desde 04/11/2026, o Creditado e o Estornado da aba Impostos (Lista), por unidade):
 * em cada unidade (Matriz e Filial), as contas de Matérias Primas, de Gastos Gerais Variáveis da Produção e o Frete e Descarga.
 */
export type ImpostosDoMes = {
  competencia: { ano: number; mes: number; status: StatusCompetencia; apurada: boolean };
  temCreditos: boolean;
  unidades: Array<{ codigo: number; nome: string; grupos: Grupo[]; total: CreditosDaConta }>;
};

/**
 * O código da conta na tabela: o do grupo, com o nome da conta (o Frete e Descarga, DVV.GGV, fica dentro dos Gastos Gerais
 * Variáveis da Produção, CPP.GGV, como na aba Impostos (Lista)); as contas do grupo ficam com o próprio código.
 */
export const codigoNaTabela = (grupo: string, conta: string) => [...grupo.split(".").slice(0, 2), ...conta.split(".").slice(2)].join(".");

export const impostosService = {
  doMes: async (anoMes: string) => (await api.get<{ data: ImpostosDoMes }>(`/proxy/competencias/${anoMes}/impostos`)).data.data,
};
