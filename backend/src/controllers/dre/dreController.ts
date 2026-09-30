import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { dreService, RegraDREError } from "../../services/dre/dreService.js";

const unidadeSchema = z.coerce.number().int().min(1).max(5);
const grupoSchema = z.string().trim().min(1).max(200).optional();

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
    if (error instanceof RegraDREError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const dreController = {
  async consultar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const u = unidadeSchema.safeParse(request.query.unidade ?? 1);
    if (!u.success) return response.status(400).json({ error: "Unidade inválida" });
    return responder(response, () => dreService.consultarUnidade(c.ano, c.mes, u.data));
  },

  async consolidado(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => dreService.consultarConsolidado(c.ano, c.mes));
  },

  /** Sem ?grupo, a lista dos agrupamentos de centros; com ele, a DRE do agrupamento. */
  async centros(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!g.success) return response.status(400).json({ error: "Centro de custo inválido" });
    return responder(response, () => (g.data ? dreService.consultarCentros(c.ano, c.mes, g.data) : dreService.listarCentros(c.ano, c.mes)));
  },

  async apurar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => dreService.apurar(c.ano, c.mes, request.user!.sub));
  },
};
