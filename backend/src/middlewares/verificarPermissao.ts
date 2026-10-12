import type { NextFunction, Request, Response } from "express";

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
