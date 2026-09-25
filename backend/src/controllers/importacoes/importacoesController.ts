import type { Request, Response } from "express";

import {
  importacoesService,
  RegraImportacaoError,
} from "../../services/importacoes/importacoesService.js";
import {
  anoMesSchema,
  receberImportacaoSchema,
} from "../../schemas/importacoes/importacaoSchemas.js";

function responderRegra(response: Response, error: unknown) {
  if (error instanceof RegraImportacaoError) {
    return response.status(error.status).json({
      error: error.message,
      codigo: error.codigo,
      detalhes: error.detalhes,
    });
  }
  throw error;
}

export const importacoesController = {
  async receber(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    const parametros = receberImportacaoSchema.safeParse(request.query);
    if (!competencia.success || !parametros.success) {
      return response.status(400).json({
        error: "Dados inválidos",
        details: [
          ...(competencia.error?.issues ?? []),
          ...(parametros.error?.issues ?? []),
        ],
      });
    }
    if (!Buffer.isBuffer(request.body)) {
      return response
        .status(400)
        .json({ error: "Envie o arquivo no corpo da requisição." });
    }

    try {
      const data = await importacoesService.receber({
        ...competencia.data,
        ...parametros.data,
        conteudo: request.body,
        usuarioId: request.user!.sub,
      });
      // 202: o arquivo foi aceito para processamento, que segue em segundo plano.
      return response.status(202).json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async listar(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    if (!competencia.success) {
      return response.status(400).json({ error: "Competência inválida" });
    }
    try {
      const data = await importacoesService.listar(
        competencia.data.ano,
        competencia.data.mes,
      );
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async detalhar(request: Request, response: Response) {
    try {
      const data = await importacoesService.detalhar(String(request.params.id));
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },
};
