import type { Request, Response } from "express";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { lancamentoManualSchema } from "../../schemas/lancamentosManuais/lancamentoManualSchema.js";
import {
  lancamentosManuaisService,
  RegraLancamentoManualError,
} from "../../services/lancamentosManuais/lancamentosManuaisService.js";

function responderRegra(response: Response, error: unknown) {
  if (error instanceof RegraLancamentoManualError) {
    return response.status(error.status).json({ error: error.message });
  }
  throw error;
}

function competencia(request: Request, response: Response) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) {
    response.status(400).json({ error: "Competência inválida" });
    return null;
  }
  return c.data;
}

function corpo(request: Request, response: Response) {
  const b = lancamentoManualSchema.safeParse(request.body);
  if (!b.success) {
    response
      .status(400)
      .json({ error: b.error.issues[0]?.message ?? "Dados inválidos", details: b.error.issues });
    return null;
  }
  return b.data;
}

export const lancamentosManuaisController = {
  async listar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    try {
      return response.json({ data: await lancamentosManuaisService.listar(c.ano, c.mes) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async opcoes(_request: Request, response: Response) {
    return response.json({ data: await lancamentosManuaisService.opcoes() });
  },

  async criar(request: Request, response: Response) {
    const c = competencia(request, response);
    const b = c && corpo(request, response);
    if (!c || !b) return;
    try {
      const data = await lancamentosManuaisService.criar(c.ano, c.mes, b, request.user!.sub);
      return response.status(201).json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async atualizar(request: Request, response: Response) {
    const b = corpo(request, response);
    if (!b) return;
    try {
      const data = await lancamentosManuaisService.atualizar(String(request.params.id), b, request.user!.sub);
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async excluir(request: Request, response: Response) {
    try {
      await lancamentosManuaisService.excluir(String(request.params.id), request.user!.sub);
      return response.status(204).end();
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async copiarDoMesAnterior(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    try {
      const data = await lancamentosManuaisService.copiarDoMesAnterior(c.ano, c.mes, request.user!.sub);
      return response.status(201).json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },
};
