import type { DepartamentoAcesso } from "../../generated/prisma/enums.js";
import type { Acesso } from "./acesso.js";

/**
 * Recorte do Gestor por departamento (decisão do usuário, 30/09/2026).
 *
 * A DRE é inteira para todos; o recorte limita as movimentações (o
 * detalhamento até os lançamentos de origem) e a visão por centro de custo aos
 * departamentos do usuário. A visibilidade segue a linha da DRE, e não o centro
 * do lançamento: quem vê uma linha vê tudo o que a formou, inclusive o que veio
 * rateado de outro departamento.
 */

export const ROTULO_DEPARTAMENTO: Record<DepartamentoAcesso, string> = {
  PRODUCAO: "Produção",
  SERVICOS: "Serviços",
  LOGISTICA: "Logística",
  TECNICO: "Técnico",
  COMERCIAL: "Comercial",
  ADMINISTRATIVO: "Administrativo",
  EXTRA_OPERACIONAL: "Extra-Operacional",
};

/** Grupo da DRE (a sigla) → departamento. As DVV se dividem pela linha. */
const POR_SIGLA: Record<string, DepartamentoAcesso> = {
  CPP: "PRODUCAO",
  CSM: "SERVICOS",
  CSC: "SERVICOS",
  DL: "LOGISTICA",
  DT: "TECNICO",
  DC: "COMERCIAL",
  DA: "ADMINISTRATIVO",
  DML: "EXTRA_OPERACIONAL",
  RFC: "EXTRA_OPERACIONAL",
  RFNC: "EXTRA_OPERACIONAL",
  DFC: "EXTRA_OPERACIONAL",
  DFNC: "EXTRA_OPERACIONAL",
};
const DVV_POR_LINHA: Record<string, DepartamentoAcesso> = {
  "FRETE E DESCARGA": "LOGISTICA",
  "COMISSÕES DE REPRESENTANTES E TERCEIROS": "COMERCIAL",
};

/** Departamento do centro de custo (campo DEPARTAMENTO do cadastro) → departamento do recorte. */
const POR_DEPARTAMENTO_DO_CENTRO: Record<string, DepartamentoAcesso> = {
  "CUSTOS DE PRODUÇÃO (CP)": "PRODUCAO",
  "CUSTOS DE SERVIÇOS: MONTAGEM (CSM)": "SERVICOS",
  "CUSTOS DE SERVIÇOS: COMPLEMENTARES (CSC)": "SERVICOS",
  "DESPESAS DE LOGÍSTICA (DL)": "LOGISTICA",
  "DESPESAS TÉCNICAS (DT)": "TECNICO",
  "DESPESAS COMERCIAIS (DC)": "COMERCIAL",
  "DESPESAS ADMINISTRATIVAS (DA)": "ADMINISTRATIVO",
};

const n = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/** O departamento de uma linha da DRE; nulo para receitas, margens e resultados, que não são de nenhum. */
export function departamentoDaLinha(l: { grupoSigla: string; descricao: string }): DepartamentoAcesso | null {
  if (l.grupoSigla === "DVV") return DVV_POR_LINHA[n(l.descricao)] ?? null;
  return POR_SIGLA[l.grupoSigla] ?? null;
}

/**
 * Grupos da DRE com as movimentações abertas a todos os gestores, de qualquer departamento (11/10/2026): a Receita
 * Operacional Bruta (ROB) e os Impostos sobre a Receita Bruta (IRB).
 */
const ABERTOS_A_TODOS = new Set(["ROB", "IRB"]);

/** O usuário pode consultar as movimentações desta linha? */
export function podeVerMovimentos(acesso: Acesso, l: { grupoSigla: string; descricao: string }) {
  if (!acesso.recorteDepartamento || ABERTOS_A_TODOS.has(l.grupoSigla)) return true;
  const d = departamentoDaLinha(l);
  return d !== null && acesso.departamentos.includes(d);
}

/** O usuário pode ver este centro de custo? Almoxarifado, investimento e requisição: só sem recorte. */
export function podeVerCentro(acesso: Acesso, departamentoDoCentro: string | null) {
  if (!acesso.recorteDepartamento) return true;
  const d = POR_DEPARTAMENTO_DO_CENTRO[n(departamentoDoCentro)];
  return d !== undefined && acesso.departamentos.includes(d);
}
