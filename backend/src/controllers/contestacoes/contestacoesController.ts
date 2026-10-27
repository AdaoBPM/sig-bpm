import type { Request, Response } from "express";
import { z } from "zod";

import { getPrismaClient } from "../../config/prisma.js";
import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { contestacoesService, RegraContestacaoError, type UsuarioDaContestacao } from "../../services/contestacoes/contestacoesService.js";

/** As contestações de gastos (27/10/2026): o pedido, as abas, a resposta, a validação e a importação para os lançamentos. */

const idSchema = z.string().min(1).max(64);
const criarSchema = z.object({
  lancamentoId: idSchema,
  centroNovoId: idSchema.nullable().default(null),
  contaNovaId: idSchema.nullable().default(null),
  motivo: z.string().trim().max(500).nullable().default(null),
});
const responderSchema = z.object({ acatar: z.boolean(), justificativa: z.string().trim().max(500).nullable().default(null) });
const situacaoSchema = z.object({
  situacao: z.enum(["PENDENTE", "ACATADA", "RECUSADA", "VALIDADA"]),
  justificativa: z.string().trim().min(1, "Escreva a justificativa").max(500),
});
const importarSchema = z.object({ ids: z.array(idSchema).min(1, "Marque ao menos uma contestação").max(2000) });
const abaSchema = z.enum(["solicitadas", "recebidas", "validacoes"]);

const usuario = (request: Request): UsuarioDaContestacao => ({ id: request.user!.sub, nome: request.user!.nome, acesso: request.user!.acesso });

async function responder(response: Response, fn: () => Promise<unknown>, status = 200) {
  try {
    return response.status(status).json({ data: await fn() });
  } catch (error) {
    if (error instanceof RegraContestacaoError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

function invalido(response: Response, e: z.ZodError) {
  return response.status(400).json({ error: e.issues[0]?.message ?? "Dados inválidos", details: e.issues });
}

function competencia(request: Request, response: Response) {
  const c = anoMesSchema.safeParse(request.params.anoMes);
  if (!c.success) {
    response.status(400).json({ error: "Competência inválida" });
    return null;
  }
  return c.data;
}

export const contestacoesController = {
  async criar(request: Request, response: Response) {
    const b = criarSchema.safeParse(request.body);
    if (!b.success) return invalido(response, b.error);
    return responder(response, () => contestacoesService.criar(b.data, usuario(request)), 201);
  },

  /** A aba (Solicitadas ou Recebidas) ou a tela Validações; a rota confere a permissão de cada uma. */
  listar: (aba: z.infer<typeof abaSchema>) => (request: Request, response: Response) => responder(response, () => contestacoesService.listar(aba, usuario(request))),

  /** As listas do modal Contestar: os centros de custo ativos e as contas analíticas ativas com destino na DRE. */
  async opcoes(_request: Request, response: Response) {
    const prisma = getPrismaClient();
    const [centros, contas] = await Promise.all([
      prisma.centroCusto.findMany({ where: { ativo: true }, orderBy: [{ codigoRM: "asc" }], select: { id: true, codigoRM: true, nomeRM: true, departamento: true } }),
      prisma.contaResultado.findMany({
        where: { ativo: true, tipoConta: "ANALITICA", linhaDREId: { not: null } },
        orderBy: { reduzido: "asc" },
        select: { id: true, reduzido: true, descricao: true, departamento: true, atribuicao: true },
      }),
    ]);
    return response.json({ data: { centros, contas } });
  },

  async responder(request: Request, response: Response) {
    const b = responderSchema.safeParse(request.body);
    if (!b.success) return invalido(response, b.error);
    return responder(response, () => contestacoesService.responder(String(request.params.id), b.data, usuario(request)));
  },

  async alterarSituacao(request: Request, response: Response) {
    const b = situacaoSchema.safeParse(request.body);
    if (!b.success) return invalido(response, b.error);
    return responder(response, () => contestacoesService.alterarSituacao(String(request.params.id), b.data, usuario(request)));
  },

  processar: (request: Request, response: Response) => responder(response, () => contestacoesService.processar(usuario(request))),

  async paraLancamentos(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => contestacoesService.paraLancamentos(c.ano, c.mes, usuario(request)));
  },

  async importar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const b = importarSchema.safeParse(request.body);
    if (!b.success) return invalido(response, b.error);
    return responder(response, () => contestacoesService.importar(c.ano, c.mes, b.data.ids, usuario(request)));
  },

  desfazerImportacao: (request: Request, response: Response) => responder(response, () => contestacoesService.desfazerImportacao(String(request.params.id), usuario(request))),
};
