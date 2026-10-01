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
