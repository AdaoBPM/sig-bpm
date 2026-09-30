import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { alcancaLista } from "../../services/acesso/acesso.js";
import { ehListaRateio, type TipoListaRateio } from "../../services/importacoes/listas/definicoesListas.js";
import { listasService, RegraListaError } from "../../services/listas/listasService.js";

const filtroSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

const corpoSchema = z.object({
  valores: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
});

/** "producao-pista" → PRODUCAO_PISTA, se for uma das listas de rateio. */
function tipoDaUrl(request: Request, response: Response): TipoListaRateio | null {
  const tipo = String(request.params.tipo ?? "").toUpperCase().replace(/-/g, "_");
  if (!ehListaRateio(tipo as never)) {
    response.status(404).json({ error: "Lista desconhecida" });
    return null;
  }
  // Recorte por setor (Passo 22): o Alimentador só alcança as listas dos seus setores.
  if (!alcancaLista(request.user!.acesso, tipo)) {
    response.status(403).json({ error: "Esta lista não é de um setor seu." });
    return null;
  }
  return tipo as TipoListaRateio;
}

function competencia(request: Request, response: Response) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) {
    response.status(400).json({ error: "Competência inválida" });
    return null;
  }
  return c.data;
}

function responderRegra(response: Response, error: unknown) {
  if (error instanceof RegraListaError) return response.status(error.status).json({ error: error.message });
  throw error;
}

export const listasController = {
  async campos(_request: Request, response: Response) {
    return response.json({ data: listasService.campos() });
  },

  async listar(request: Request, response: Response) {
    const tipo = tipoDaUrl(request, response);
    const c = tipo && competencia(request, response);
    if (!tipo || !c) return;
    const filtro = filtroSchema.safeParse({ ...request.query });
    if (!filtro.success) return response.status(400).json({ error: "Parâmetros inválidos" });
    try {
      return response.json({ data: await listasService.listar(tipo, c.ano, c.mes, filtro.data) });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async criar(request: Request, response: Response) {
    const tipo = tipoDaUrl(request, response);
    const c = tipo && competencia(request, response);
    if (!tipo || !c) return;
    const corpo = corpoSchema.safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Dados inválidos" });
    try {
      await listasService.criar(tipo, c.ano, c.mes, corpo.data.valores, request.user!.sub);
      return response.status(201).json({ data: { ok: true } });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async atualizar(request: Request, response: Response) {
    const tipo = tipoDaUrl(request, response);
    if (!tipo) return;
    const corpo = corpoSchema.safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Dados inválidos" });
    try {
      await listasService.atualizar(tipo, String(request.params.id), corpo.data.valores);
      return response.json({ data: { ok: true } });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async excluir(request: Request, response: Response) {
    const tipo = tipoDaUrl(request, response);
    if (!tipo) return;
    try {
      await listasService.excluir(tipo, String(request.params.id));
      return response.status(204).end();
    } catch (error) {
      return responderRegra(response, error);
    }
  },
};
