import type { Request, Response } from "express";

import {
  competenciasService,
  RegraCompetenciaError,
} from "../../services/competencias/competenciasService.js";
import { abrirCompetenciaSchema } from "../../schemas/competencias/abrirCompetenciaSchema.js";

export const competenciasController = {
  async listar(request: Request, response: Response) {
    const anoBruto = request.query.ano;
    const ano = anoBruto ? Number(anoBruto) : undefined;
    if (ano !== undefined && !Number.isInteger(ano)) {
      return response.status(400).json({ error: "Ano inválido" });
    }

    const [itens, anos] = await Promise.all([
      competenciasService.listar(ano),
      competenciasService.anosDisponiveis(),
    ]);

    return response.json({ data: { itens, anos } });
  },

  async abrir(request: Request, response: Response) {
    const parametros = abrirCompetenciaSchema.safeParse(request.body);
    if (!parametros.success) {
      return response
        .status(400)
        .json({ error: "Dados inválidos", details: parametros.error.issues });
    }

    try {
      const data = await competenciasService.abrir(
        parametros.data,
        request.user!.sub,
      );
      return response.status(201).json({ data });
    } catch (error) {
      if (error instanceof RegraCompetenciaError) {
        return response.status(409).json({ error: error.message });
      }
      throw error;
    }
  },
};
