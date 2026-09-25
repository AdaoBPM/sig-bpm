import type { Request, Response } from "express";

import {
  classificacaoService,
  RegraClassificacaoError,
} from "../../services/classificacao/classificacaoService.js";
import { listarClassificacaoSchema } from "../../schemas/classificacao/classificacaoSchemas.js";
import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";

function responderRegra(response: Response, error: unknown) {
  if (error instanceof RegraClassificacaoError) {
    return response.status(error.status).json({ error: error.message });
  }
  throw error;
}

export const classificacaoController = {
  async resumo(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    if (!competencia.success) {
      return response.status(400).json({ error: "Competência inválida" });
    }
    try {
      const data = await classificacaoService.resumo(competencia.data.ano, competencia.data.mes);
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async listar(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    const filtro = listarClassificacaoSchema.safeParse(request.query);
    if (!competencia.success || !filtro.success) {
      return response.status(400).json({ error: "Parâmetros inválidos" });
    }
    try {
      const data = await classificacaoService.listar({ ...competencia.data, ...filtro.data });
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async reclassificar(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    if (!competencia.success) {
      return response.status(400).json({ error: "Competência inválida" });
    }
    try {
      const data = await classificacaoService.reclassificar(
        competencia.data.ano,
        competencia.data.mes,
      );
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },
};
