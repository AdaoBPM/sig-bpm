import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { divergenciasService, RegraDivergenciaError } from "../../services/divergencias/divergenciasService.js";
import { RegraApuracaoError } from "../../services/apuracao/apuracaoService.js";

const filtroSchema = z.object({
  competencia: anoMesSchema.optional(),
  tipo: z.enum(["BALANCETE", "PRECO_CONTRATO"]).optional(),
  status: z.enum(["ABERTA", "JUSTIFICADA", "RESOLVIDA_POR_REABERTURA", "RESOLVIDA_POR_REAPURACAO"]).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  // A tela carrega todas as do filtro de uma vez para filtrar pelos rótulos das colunas.
  porPagina: z.coerce.number().int().min(1).max(5000).default(100),
});
const justificarSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(5000), justificativa: z.string().trim().min(15, "Explique a divergência (ao menos 15 caracteres).").max(2000) });
const resolverSchema = z.object({ competencia: anoMesSchema, justificativa: z.string().trim().min(15, "Explique o motivo da reabertura (ao menos 15 caracteres).").max(2000) });

async function responder(response: Response, fn: () => Promise<unknown>) {
  try {
    return response.json({ data: await fn() });
  } catch (error) {
    if (error instanceof RegraDivergenciaError || error instanceof RegraApuracaoError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const divergenciasController = {
  async listar(request: Request, response: Response) {
    const f = filtroSchema.safeParse(request.query);
    if (!f.success) return response.status(400).json({ error: "Filtro inválido" });
    const { competencia, ...resto } = f.data;
    return responder(response, () => divergenciasService.listar({ ...resto, ano: competencia?.ano, mes: competencia?.mes }, request.user!.acesso));
  },

  async justificar(request: Request, response: Response) {
    const b = justificarSchema.safeParse(request.body);
    if (!b.success) return response.status(400).json({ error: b.error.issues[0]?.message ?? "Dados inválidos" });
    return responder(response, () => divergenciasService.justificar(b.data.ids, b.data.justificativa, request.user!.sub));
  },

  async resolver(request: Request, response: Response) {
    const b = resolverSchema.safeParse(request.body);
    if (!b.success) return response.status(400).json({ error: b.error.issues[0]?.message ?? "Dados inválidos" });
    return responder(response, () => divergenciasService.resolverPorReabertura(b.data.competencia.ano, b.data.competencia.mes, b.data.justificativa, request.user!.sub));
  },
};
