import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  // Corpo acima do limite do express.raw/express.json: é erro do envio, não do servidor.
  const tipo = (error as { type?: string }).type;
  if (tipo === "entity.too.large") {
    return response.status(413).json({
      error: `Envio acima do limite (arquivos até ${env.UPLOAD_MAX_MB} MB; dados de formulário até 1 MB).`,
    });
  }
  if (tipo === "entity.parse.failed") {
    return response.status(400).json({ error: "JSON inválido." });
  }

  logger("error", "Erro não tratado", {
    error: error instanceof Error ? error.message : String(error),
  });

  return response.status(500).json({ error: "Erro interno do servidor" });
}
