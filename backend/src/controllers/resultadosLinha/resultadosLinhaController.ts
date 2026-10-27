import type { Request, Response } from "express";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { ABA_DA_VISAO } from "../../services/acesso/telas.js";
import { RegraLinhasError, resultadosLinhaService } from "../../services/resultadosLinha/resultadosLinhaService.js";

/** As unidades das linhas que o perfil lê no mês: as abas Matriz, Filial e Serviços da tela Resultados (dre). */
const unidadesDoMes = (request: Request) => [1, 2, 3].filter((u) => request.user!.permissions.includes(`dre.${ABA_DA_VISAO[u]}:ler`));

/** A etapa Linhas do Fechamento Mensal (26/10/2026): a conferência do mês gravado e a gravação de um mês fechado antes dela. */
async function responder(request: Request, response: Response, fn: (ano: number, mes: number) => Promise<unknown>) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) return response.status(400).json({ error: "Competência inválida" });
  try {
    return response.json({ data: await fn(c.data.ano, c.data.mes) });
  } catch (error) {
    if (error instanceof RegraLinhasError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const resultadosLinhaController = {
  /** GET /competencias/:anoMes/linhas */
  async doMes(request: Request, response: Response) {
    return responder(request, response, (ano, mes) => resultadosLinhaService.doMes(ano, mes));
  },

  /**
   * GET /competencias/:anoMes/linhas/lista (27/10/2026): as linhas das unidades que o perfil lê, para a lista da etapa
   * (as ativas e as inativas com valor no mês), como a aba Linhas dos Resultados Empresariais.
   */
  async lista(request: Request, response: Response) {
    return responder(request, response, (ano, mes) => resultadosLinhaService.listar(ano, mes, unidadesDoMes(request), true));
  },

  /** GET /competencias/:anoMes/linhas/linha/:linhaId: a DRE da linha no mês, da receita à Margem de Contribuição. */
  async linha(request: Request, response: Response) {
    const id = String(request.params.linhaId ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return response.status(400).json({ error: "Linha inválida" });
    return responder(request, response, (ano, mes) => resultadosLinhaService.linha(ano, mes, id, false, unidadesDoMes(request), true));
  },

  /** POST /competencias/:anoMes/linhas/gravar */
  async gravar(request: Request, response: Response) {
    return responder(request, response, (ano, mes) => resultadosLinhaService.gravarFechada(ano, mes, request.user!.sub));
  },
};
