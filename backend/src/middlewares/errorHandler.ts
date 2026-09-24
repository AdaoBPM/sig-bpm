import type { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  logger("error", "Erro não tratado", {
    error: error instanceof Error ? error.message : String(error),
  });

  return response.status(500).json({ error: "Erro interno do servidor" });
}
