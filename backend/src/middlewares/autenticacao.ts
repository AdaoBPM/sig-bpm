import type { NextFunction, Request, Response } from "express";

import { verifyToken } from "../lib/jwt.js";
import { carregarUsuario } from "../services/acesso/acesso.js";

/**
 * Valida o token e relê o usuário do banco: permissões e recortes vêm do
 * perfil atual, e um usuário ou perfil inativado perde o acesso na hora, sem
 * esperar o token vencer (Passo 22).
 */
export async function autenticacao(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return response.status(401).json({ error: "Token não informado" });
  }

  let sub: string;
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    // O token da Biblioteca de APIs (24/10/2026) não abre o SIG: só as rotas da API (/v1).
    if (payload.escopo === "api") return response.status(401).json({ error: "Token inválido ou expirado" });
    sub = payload.sub;
  } catch {
    return response.status(401).json({ error: "Token inválido ou expirado" });
  }

  try {
    const usuario = await carregarUsuario({ id: sub });
    if (!usuario) return response.status(401).json({ error: "Usuário inativo ou sem acesso" });
    const { senhaHash: _, ...user } = usuario;
    request.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}
