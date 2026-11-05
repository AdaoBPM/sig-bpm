import type { Request, Response } from "express";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { creditosImpostosService, RegraImpostosError } from "../../services/impostos/creditosImpostosService.js";

export const creditosImpostosController = {
  /** GET /competencias/:anoMes/impostos: os Créditos de Impostos do mês (03/11/2026). */
  async doMes(request: Request, response: Response) {
    const c = anoMesSchema.safeParse(request.params.anoMes);
    if (!c.success) return response.status(400).json({ error: "Competência inválida" });
    try {
      return response.json({ data: await creditosImpostosService.doMes(c.data.ano, c.data.mes) });
    } catch (error) {
      if (error instanceof RegraImpostosError) return response.status(error.status).json({ error: error.message });
      throw error;
    }
  },
};
