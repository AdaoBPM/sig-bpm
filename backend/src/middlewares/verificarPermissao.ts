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
