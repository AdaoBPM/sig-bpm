import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type RequestPart = "body" | "query" | "params";

export function validacao<T>(schema: ZodType<T>, part: RequestPart = "body") {
  return (request: Request, response: Response, next: NextFunction) => {
    const result = schema.safeParse(request[part]);

    if (!result.success) {
      return response.status(400).json({
        error: "Dados inválidos",
        details: result.error.issues,
      });
    }

    request[part] = result.data;
    return next();
  };
}
