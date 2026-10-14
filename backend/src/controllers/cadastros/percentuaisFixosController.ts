import type { Request, Response } from "express";
import { z } from "zod";

import { percentuaisFixosService } from "../../services/volumes/percentuaisFixosService.js";
import { RegraRateioError } from "../../services/volumes/rateiosService.js";

async function responder(response: Response, fn: () => Promise<unknown>) {
  try {
    return response.json({ data: await fn() });
  } catch (error) {
    if (error instanceof RegraRateioError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Os percentuais fixos das regras de rateio e a verificação das vigências (14/10/2026). */
export const percentuaisFixosController = {
  listar(_request: Request, response: Response) {
    return responder(response, () => percentuaisFixosService.listar());
  },

  verificacao(_request: Request, response: Response) {
    return responder(response, () => percentuaisFixosService.verificacao());
  },

  gravar(request: Request, response: Response) {
    const corpo = z
      .object({ chave: z.string().min(1), inicioAnterior: DATA.nullable(), inicio: DATA, fim: DATA.nullable(), percentuais: z.record(z.string(), z.number().finite()) })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Percentuais fixos inválidos." });
    return responder(response, () => percentuaisFixosService.gravar(corpo.data, request.user!.sub));
  },

  excluir(request: Request, response: Response) {
    const q = z.object({ chave: z.string().min(1), inicio: DATA }).safeParse(request.query);
    if (!q.success) return response.status(400).json({ error: "Informe a chave e o início do conjunto." });
    return responder(response, () => percentuaisFixosService.excluir(q.data.chave, q.data.inicio, request.user!.sub));
  },
};
