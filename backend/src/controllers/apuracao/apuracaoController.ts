import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { apuracaoService, RegraApuracaoError } from "../../services/apuracao/apuracaoService.js";

const reaberturaSchema = z.object({ justificativa: z.string().trim().min(15, "Explique o motivo da reabertura (ao menos 15 caracteres).").max(2000) });

function competencia(request: Request, response: Response) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) {
    response.status(400).json({ error: "Competência inválida" });
    return null;
  }
  return c.data;
}

async function responder(response: Response, fn: () => Promise<unknown>) {
  try {
    return response.json({ data: await fn() });
  } catch (error) {
    if (error instanceof RegraApuracaoError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const apuracaoController = {
  async situacao(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => apuracaoService.situacao(c.ano, c.mes));
  },

  async apurar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => apuracaoService.apurar(c.ano, c.mes, request.user!.sub));
  },

  async fechar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => apuracaoService.fechar(c.ano, c.mes, request.user!.sub));
  },

  async excluir(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => apuracaoService.excluir(c.ano, c.mes, request.user!.sub));
  },

  async reabrir(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const b = reaberturaSchema.safeParse(request.body);
    if (!b.success) return response.status(400).json({ error: b.error.issues[0]?.message ?? "Justificativa inválida" });
    return responder(response, () => apuracaoService.reabrir(c.ano, c.mes, b.data.justificativa, request.user!.sub));
  },
};
