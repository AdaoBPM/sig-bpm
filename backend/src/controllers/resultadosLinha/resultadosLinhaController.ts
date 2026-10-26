import type { Request, Response } from "express";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { RegraLinhasError, resultadosLinhaService } from "../../services/resultadosLinha/resultadosLinhaService.js";

/** A etapa Linhas do Fechamento Mensal (26/10/2026): a conferência do mês gravado e a gravação de um mês fechado antes dela. */
async function responder(request: Request, response: Response, fn: (ano: number, mes: number) => Promise<unknown>) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) return response.status(400).json({ error: "Competência inválida" });
  try {
    return response.json({ data: await fn(c.data.ano, c.data.mes) });
  } catch (error) {
    if (error instanceof RegraLinhasError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const resultadosLinhaController = {
  /** GET /competencias/:anoMes/linhas */
  async doMes(request: Request, response: Response) {
    return responder(request, response, (ano, mes) => resultadosLinhaService.doMes(ano, mes));
  },

  /** POST /competencias/:anoMes/linhas/gravar */
  async gravar(request: Request, response: Response) {
    return responder(request, response, (ano, mes) => resultadosLinhaService.gravarFechada(ano, mes, request.user!.sub));
  },
};
