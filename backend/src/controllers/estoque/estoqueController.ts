import type { Request, Response } from "express";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { estoqueService, RegraEstoqueError } from "../../services/estoque/estoqueService.js";
import { auditar } from "../../services/auditoriaService.js";

function competencia(request: Request, response: Response) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) {
    response.status(400).json({ error: "Competência inválida" });
    return null;
  }
  return c.data;
}

async function responder(response: Response, fn: () => Promise<unknown>) {
  try {
    return response.json({ data: await fn() });
  } catch (error) {
    if (error instanceof RegraEstoqueError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const estoqueController = {
  async consultar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => estoqueService.consultar(c.ano, c.mes));
  },

  async apurar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => (async () => {
      const r = await estoqueService.apurar(c.ano, c.mes);
      await auditar({ usuarioId: request.user!.sub, usuarioNome: request.user!.nome, acao: "APURACAO_PARCIAL", entidade: "competencia", entidadeId: `${c.ano}-${String(c.mes).padStart(2, "0")}`, metadados: { parte: "saldo de estoque" } });
      return r;
    })());
  },
};
