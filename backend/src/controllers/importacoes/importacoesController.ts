import type { Request, Response } from "express";
import { z } from "zod";

import { alcancaLista } from "../../services/acesso/acesso.js";
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
    // Recorte por setor (Passo 22): quem tem setores só importa as listas deles.
    if (!alcancaLista(request.user!.acesso, parametros.data.tipo)) {
      return response.status(403).json({ error: "Este tipo de arquivo não é de um setor seu." });
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

  /** Um arquivo com várias abas: cada aba reconhecida vira uma importação, na fila. */
  async receberLote(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    const nome = z.string().trim().min(1).max(255).safeParse(request.query.nomeArquivo);
    if (!competencia.success || !nome.success) return response.status(400).json({ error: "Informe a competência e o nome do arquivo." });
    if (!Buffer.isBuffer(request.body)) return response.status(400).json({ error: "Envie o arquivo no corpo da requisição." });
    try {
      const data = await importacoesService.receberLote({
        ...competencia.data,
        nomeArquivo: nome.data,
        conteudo: request.body,
        usuarioId: request.user!.sub,
        alcanca: (tipo) => alcancaLista(request.user!.acesso, tipo),
      });
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
      return response.json({ data: { ...data, itens: data.itens.filter((i) => alcancaLista(request.user!.acesso, i.tipo)) } });
    } catch (error) {
      return responderRegra(response, error);
    }
  },

  async detalhar(request: Request, response: Response) {
    try {
      const data = await importacoesService.detalhar(String(request.params.id));
      if (!alcancaLista(request.user!.acesso, data.tipo)) return response.status(403).json({ error: "Esta importação não é de um setor seu." });
      return response.json({ data });
    } catch (error) {
      return responderRegra(response, error);
    }
  },
};
