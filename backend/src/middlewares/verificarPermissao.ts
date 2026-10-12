import type { NextFunction, Request, Response } from "express";

import { getPrismaClient } from "../config/prisma.js";

export function verificarPermissao(permission: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const permissions = request.user?.permissions ?? [];

    if (!permissions.includes(permission)) {
      return response.status(403).json({ error: "Sem permissão para esta ação" });
    }

    return next();
  };
}

/** Basta uma das permissões: para uma consulta que várias telas usam. */
export function verificarAlgumaPermissao(...permissoes: string[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const tem = request.user?.permissions ?? [];
    if (!permissoes.some((p) => tem.includes(p))) {
      return response.status(403).json({ error: "Sem permissão para esta ação" });
    }
    return next();
  };
}

/**
 * A DRE e os indicadores do mês: as etapas DRE e Indicadores do Fechamento Mensal e as telas dos Resultados Realizados
 * (com o extrato das contas) mostram os mesmos números; basta um dos dois grupos.
 */
export const lerResultados = verificarAlgumaPermissao("dre:ler", "resultados:ler");

/**
 * A DRE de um mês (/competencias/:anoMes/dre…): com o Fechamento Mensal (dre:ler), qualquer mês; só com os Resultados
 * Realizados, só as competências fechadas, que é o que aquelas telas mostram (11/10/2026).
 */
export async function lerDREDoMes(request: Request, response: Response, next: NextFunction) {
  const tem = request.user?.permissions ?? [];
  if (tem.includes("dre:ler")) return next();
  if (!tem.includes("resultados:ler")) return response.status(403).json({ error: "Sem permissão para esta ação" });
  const m = /^(\d{4})-(\d{2})$/.exec(String(request.params.anoMes ?? ""));
  if (!m) return response.status(400).json({ error: "Competência inválida." });
  try {
    const c = await getPrismaClient().competencia.findUnique({ where: { ano_mes: { ano: Number(m[1]), mes: Number(m[2]) } }, select: { status: true } });
    if (c?.status !== "FECHADA") return response.status(403).json({ error: "Os Resultados Realizados mostram só as competências fechadas." });
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * O grupo do menu de cada cadastro (11/10/2026): os Cadastros da Apuração e os da Controladoria têm permissões
 * próprias. A chave é a entidade da rota (/cadastros/edicao/:entidade).
 */
export const AREA_DO_CADASTRO: Record<string, "cadastros_apuracao" | "cadastros_controladoria"> = {
  reclassificacoes: "cadastros_apuracao",
  "precos-contrato": "cadastros_apuracao",
  "tipos-movimento": "cadastros_apuracao",
  "tabela-estacas": "cadastros_apuracao",
  unidades: "cadastros_controladoria",
  linhas: "cadastros_controladoria",
  "centros-custo": "cadastros_controladoria",
  "contas-resultado": "cadastros_controladoria",
  "estrutura-indicadores": "cadastros_controladoria",
  "regras-rateio": "cadastros_controladoria",
  "estrutura-dre": "cadastros_controladoria",
};

/** A permissão do grupo do cadastro da rota (:entidade); entidade desconhecida segue adiante (a rota responde 404). */
export function verificarPermissaoDoCadastro(acao: "ler" | "editar") {
  return (request: Request, response: Response, next: NextFunction) => {
    const area = AREA_DO_CADASTRO[String(request.params.entidade)];
    if (!area) return next();
    return verificarPermissao(`${area}:${acao}`)(request, response, next);
  };
}
