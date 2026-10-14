import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { ABA_DA_VISAO } from "../../services/acesso/telas.js";
import { ConferenciaError, conferenciaPlanilhaService, LIMITE_PADRAO } from "../../services/conferencia/conferenciaPlanilhaService.js";

const nomeArquivoSchema = z.string().trim().min(1).max(255);
// O limite vem da tela, com vírgula ou ponto.
const limiteSchema = z.preprocess((v) => (typeof v === "string" ? v.replace(",", ".") : v), z.coerce.number().min(0).max(1_000_000));

async function responder(response: Response, fn: () => Promise<unknown>, status = 200) {
  try {
    return response.status(status).json({ data: await fn() });
  } catch (error) {
    if (error instanceof ConferenciaError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

/** Relatório de conferência contra a planilha (Passo 27): montado em /competencias/:anoMes/conferencia-planilha. */
export const conferenciaPlanilhaController = {
  async relatorio(request: Request, response: Response) {
    const c = anoMesSchema.safeParse(request.params.anoMes);
    if (!c.success) return response.status(400).json({ error: "Competência inválida" });
    const l = limiteSchema.safeParse(request.query.limite ?? LIMITE_PADRAO);
    if (!l.success) return response.status(400).json({ error: "Limite inválido: use um número a partir de zero." });
    // Só as visões (as abas da tela) permitidas (14/10/2026).
    const permitidas = new Set(ABA_DA_VISAO.flatMap((a, k) => (request.user!.permissions.includes(`conferencia.${a}:ler`) ? [k] : [])));
    return responder(response, async () => {
      const r = await conferenciaPlanilhaService.relatorio(c.data.ano, c.data.mes, l.data);
      return { ...r, visoes: r.visoes.filter((v) => permitidas.has(v.unidade)) };
    });
  },

  async receber(request: Request, response: Response) {
    const c = anoMesSchema.safeParse(request.params.anoMes);
    if (!c.success) return response.status(400).json({ error: "Competência inválida" });
    const nome = nomeArquivoSchema.safeParse(request.query.nomeArquivo);
    if (!nome.success) return response.status(400).json({ error: "Informe o nome do arquivo." });
    if (!Buffer.isBuffer(request.body)) return response.status(400).json({ error: "Envie o arquivo no corpo da requisição." });
    return responder(
      response,
      () => conferenciaPlanilhaService.receber(c.data.ano, c.data.mes, nome.data, new Uint8Array(request.body as Buffer), request.user!.sub, request.user!.nome),
      201,
    );
  },
};
