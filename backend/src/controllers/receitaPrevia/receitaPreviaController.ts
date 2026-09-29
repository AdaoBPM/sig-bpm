import type { Request, Response } from "express";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { itensReceitaSchema, lancamentoReceitaSchema } from "../../schemas/receitaPrevia/receitaPreviaSchemas.js";
import { lancamentosReceitaService } from "../../services/receitaPrevia/lancamentosReceitaService.js";
import { receitaPreviaService, RegraReceitaError } from "../../services/receitaPrevia/receitaPreviaService.js";

function responderRegra(response: Response, error: unknown) {
  if (error instanceof RegraReceitaError) return response.status(error.status).json({ error: error.message });
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
  const b = lancamentoReceitaSchema.safeParse(request.body);
  if (!b.success) {
    response.status(400).json({ error: b.error.issues[0]?.message ?? "Dados inválidos", details: b.error.issues });
    return null;
  }
  return b.data;
}

export const receitaPreviaController = {
  async consultar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    try {
      return response.json({ data: await receitaPreviaService.consultar(c.ano, c.mes) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async apurar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    try {
      return response.json({ data: await receitaPreviaService.apurar(c.ano, c.mes) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async itens(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const p = itensReceitaSchema.safeParse({ ...request.query });
    if (!p.success) return response.status(400).json({ error: "Dados inválidos", details: p.error.issues });
    try {
      const { unidade, natureza, pagina, porPagina } = p.data;
      return response.json({ data: await receitaPreviaService.itens(c.ano, c.mes, unidade, natureza, pagina, porPagina) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async listarLancamentos(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    try {
      return response.json({ data: await lancamentosReceitaService.listar(c.ano, c.mes) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async opcoesLancamento(_request: Request, response: Response) {
    return response.json({ data: lancamentosReceitaService.opcoes() });
  },

  async criarLancamento(request: Request, response: Response) {
    const c = competencia(request, response);
    const b = c && corpo(request, response);
    if (!c || !b) return;
    try {
      return response.status(201).json({ data: await lancamentosReceitaService.criar(c.ano, c.mes, b, request.user!.sub) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async atualizarLancamento(request: Request, response: Response) {
    const b = corpo(request, response);
    if (!b) return;
    try {
      return response.json({ data: await lancamentosReceitaService.atualizar(String(request.params.id), b) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async excluirLancamento(request: Request, response: Response) {
    try {
      await lancamentosReceitaService.excluir(String(request.params.id));
      return response.status(204).end();
    } catch (error) {
      return responderRegra(response, error);
    }
  },
};
