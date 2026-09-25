import type { Request, Response } from "express";

import { cadastrosService } from "../../services/cadastros/cadastrosService.js";
import { listarCadastroSchema } from "../../schemas/cadastros/listarCadastroSchema.js";

/**
 * O Express 5 expõe `req.query` como getter, então o middleware `validacao`
 * não consegue substituí-lo. Aqui o schema é aplicado sobre uma cópia, o que
 * mantém a validação com Zod sem mexer no objeto da request.
 */
function lerParametros(request: Request) {
  const resultado = listarCadastroSchema.safeParse({ ...request.query });
  return resultado;
}

export const cadastrosController = {
  async listarCentrosCusto(request: Request, response: Response) {
    const parametros = lerParametros(request);
    if (!parametros.success) {
      return response
        .status(400)
        .json({ error: "Dados inválidos", details: parametros.error.issues });
    }

    const data = await cadastrosService.listarCentrosCusto(parametros.data);
    return response.json({ data });
  },

  async listarContasResultado(request: Request, response: Response) {
    const parametros = lerParametros(request);
    if (!parametros.success) {
      return response
        .status(400)
        .json({ error: "Dados inválidos", details: parametros.error.issues });
    }

    const data = await cadastrosService.listarContasResultado(parametros.data);
    return response.json({ data });
  },

  async listarLinhasDRE(request: Request, response: Response) {
    const parametros = lerParametros(request);
    if (!parametros.success) {
      return response
        .status(400)
        .json({ error: "Dados inválidos", details: parametros.error.issues });
    }

    const data = await cadastrosService.listarLinhasDRE(parametros.data);
    return response.json({ data });
  },

  async listarReclassificacoes(request: Request, response: Response) {
    const parametros = lerParametros(request);
    if (!parametros.success) {
      return response
        .status(400)
        .json({ error: "Dados inválidos", details: parametros.error.issues });
    }

    const data = await cadastrosService.listarReclassificacoes(parametros.data);
    return response.json({ data });
  },

  async resumo(_request: Request, response: Response) {
    const data = await cadastrosService.resumo();
    return response.json({ data });
  },
};
