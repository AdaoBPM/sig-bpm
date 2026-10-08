import type { Request, Response } from "express";
import { z } from "zod";

import { indicadoresService } from "../../services/relatorios/indicadoresService.js";
import { RelatorioError, resultadosService } from "../../services/relatorios/resultadosService.js";

const anoSchema = z.coerce.number().int().min(2025).max(2100);
const ateSchema = z.coerce.number().int().min(1).max(12).optional();
const visaoSchema = z.union([z.literal("centros"), z.coerce.number().int().min(0).max(5)]);
const grupoSchema = z.string().trim().min(1).max(200).optional();

async function responder(response: Response, fn: () => Promise<unknown>) {
  try {
    return response.json({ data: await fn() });
  } catch (error) {
    if (error instanceof RelatorioError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

/** ?ano= e ?ate= (o último mês; sem ele, o último apurado). */
function periodo(request: Request, response: Response) {
  const ano = anoSchema.safeParse(request.query.ano);
  const ate = ateSchema.safeParse(request.query.ate || undefined);
  if (!ano.success || !ate.success) {
    response.status(400).json({ error: "Exercício ou mês inválido" });
    return null;
  }
  return { ano: ano.data, ate: ate.data };
}

export const relatoriosController = {
  /** ?visao=0..5 (0 Consolidado) ou ?visao=centros: sem ?grupo, a lista dos agrupamentos; com ele, o agrupamento. */
  async resultados(request: Request, response: Response) {
    const p = periodo(request, response);
    if (!p) return;
    const v = visaoSchema.safeParse(request.query.visao ?? 0);
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!v.success || !g.success) return response.status(400).json({ error: "Visão inválida" });
    const acesso = request.user!.acesso;
    if (v.data === "centros") {
      return responder(response, () => (g.data ? resultadosService.centros(p.ano, g.data, p.ate, acesso) : resultadosService.listarCentros(p.ano, p.ate, acesso)));
    }
    const visao = v.data as 0 | 1 | 2 | 3 | 4 | 5;
    return responder(response, () => resultadosService.unidade(p.ano, visao, p.ate));
  },

  async indicadores(request: Request, response: Response) {
    const p = periodo(request, response);
    if (!p) return;
    return responder(response, () => indicadoresService.listar(p.ano, p.ate));
  },
};
