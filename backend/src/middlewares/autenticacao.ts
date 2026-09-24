import type { NextFunction, Request, Response } from "express";

import { verifyToken } from "../lib/jwt.js";

export function autenticacao(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return response.status(401).json({ error: "Token não informado" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken(token);
    request.user = payload;
    return next();
  } catch {
    return response.status(401).json({ error: "Token inválido ou expirado" });
  }
}
