import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { detalhamentoService } from "../../services/dre/detalhamentoService.js";
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
    return responder(response, () => dreService.consultarUnidade(c.ano, c.mes, u.data, request.user!.acesso));
  },

  async consolidado(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => dreService.consultarConsolidado(c.ano, c.mes, request.user!.acesso));
  },

  /** Sem ?grupo, a lista dos agrupamentos de centros; com ele, a DRE do agrupamento. */
  async centros(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!g.success) return response.status(400).json({ error: "Centro de custo inválido" });
    return responder(response, () => (g.data ? dreService.consultarCentros(c.ano, c.mes, g.data, request.user!.acesso) : dreService.listarCentros(c.ano, c.mes, request.user!.acesso)));
  },

  /** Detalhamento de uma linha: ?linha=código e ?unidade=1..5, ?grupo=centro, ou nenhum dos dois (consolidado). */
  async detalhe(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const linha = z.string().trim().min(1).max(200).safeParse(request.query.linha);
    if (!linha.success) return response.status(400).json({ error: "Linha da DRE inválida" });
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!g.success) return response.status(400).json({ error: "Centro de custo inválido" });
    let visao: Parameters<typeof detalhamentoService.detalhar>[3] = { consolidado: true };
    if (g.data) visao = { grupo: g.data };
    else if (request.query.unidade !== undefined) {
      const u = unidadeSchema.safeParse(request.query.unidade);
      if (!u.success) return response.status(400).json({ error: "Unidade inválida" });
      visao = { unidade: u.data };
    }
    return responder(response, () => detalhamentoService.detalhar(c.ano, c.mes, linha.data, visao, request.user!.acesso));
  },

  async apurar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => dreService.apurar(c.ano, c.mes, request.user!.sub));
  },
};
