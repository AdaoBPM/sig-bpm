import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { RegraImportacaoError } from "../../services/importacoes/importacoesService.js";
import { RelatorioError } from "../../services/relatorios/resultadosService.js";
import { resultadosLinhaService } from "../../services/resultadosLinha/resultadosLinhaService.js";

const anoSchema = z.coerce.number().int().min(2000).max(2100);
const ateSchema = z.coerce.number().int().min(1).max(12).optional();

/** Os Resultados por Linha (26/10/2026): o exercício até um mês, os documentos de cada mês e a importação deles. */
export const resultadosLinhaController = {
  /** GET /resultados-por-linha?ano=&ate= */
  async calcular(request: Request, response: Response) {
    const ano = anoSchema.safeParse(request.query.ano);
    const ate = ateSchema.safeParse(request.query.ate || undefined);
    if (!ano.success || !ate.success) return response.status(400).json({ error: "Informe o ano (e, se quiser, o mês até o qual somar)." });
    try {
      return response.json({ data: await resultadosLinhaService.calcular(ano.data, ate.data) });
    } catch (error) {
      if (error instanceof RelatorioError) return response.status(error.status).json({ error: error.message });
      throw error;
    }
  },

  /** GET /resultados-por-linha/documentos?ano= */
  async documentos(request: Request, response: Response) {
    const ano = anoSchema.safeParse(request.query.ano);
    if (!ano.success) return response.status(400).json({ error: "Informe o ano." });
    return response.json({ data: await resultadosLinhaService.documentos(ano.data) });
  },

  /** POST /resultados-por-linha/documentos/:anoMes?nomeArquivo= — o arquivo cru no corpo. */
  async importarDocumentos(request: Request, response: Response) {
    const competencia = anoMesSchema.safeParse(request.params.anoMes);
    const nome = z.string().trim().min(1).max(255).safeParse(request.query.nomeArquivo);
    if (!competencia.success || !nome.success) return response.status(400).json({ error: "Informe a competência e o nome do arquivo." });
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) return response.status(400).json({ error: "Envie o arquivo no corpo da requisição." });
    try {
      const data = await resultadosLinhaService.importarDocumentos(competencia.data.ano, competencia.data.mes, nome.data, request.body, request.user!.sub);
      return response.status(202).json({ data });
    } catch (error) {
      if (error instanceof RegraImportacaoError) return response.status(error.status).json({ error: error.message, codigo: error.codigo });
      throw error;
    }
  },
};
