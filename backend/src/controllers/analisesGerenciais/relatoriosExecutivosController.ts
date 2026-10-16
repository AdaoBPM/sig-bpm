import type { Request, Response } from "express";
import { z } from "zod";

import { CODIGO_ADMINISTRADOR } from "../../services/acesso/acesso.js";
import { DEPARTAMENTOS, RelatorioExecutivoError, relatoriosExecutivosService as s, type UsuarioDoRelatorio } from "../../services/analisesGerenciais/relatoriosExecutivosService.js";

/** O usuário da requisição, com os departamentos do recorte (sem recorte, nulo: escolhe ao criar). */
const usuario = (request: Request): UsuarioDoRelatorio => ({
  id: request.user!.sub,
  nome: request.user!.nome,
  admin: request.user!.perfil.codigo === CODIGO_ADMINISTRADOR,
  departamentos: request.user!.acesso.recorteDepartamento ? request.user!.acesso.departamentos : null,
});

async function responder(response: Response, fn: () => Promise<unknown>, status = 200) {
  try {
    return response.status(status).json({ data: await fn() });
  } catch (error) {
    if (error instanceof RelatorioExecutivoError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

function id(request: Request, response: Response) {
  const r = z.string().uuid().safeParse(request.params.id);
  if (!r.success) response.status(400).json({ error: "Relatório inválido." });
  return r.success ? r.data : null;
}

const departamento = z.enum(DEPARTAMENTOS as [string, ...string[]]);
const posicao = { id: z.string().min(1).max(60), x: z.number().int().min(0).max(24), y: z.number().int().min(0).max(2000), w: z.number().int().min(1).max(24), h: z.number().int().min(1).max(200) };
const bloco = z.discriminatedUnion("tipo", [
  z.object({ ...posicao, tipo: z.literal("PAINEL"), aba: z.enum(["resultados", "performance"]), quadro: z.string().max(200), titulo: z.string().max(200), sigla: z.string().max(60), comGrafico: z.boolean() }),
  z.object({ ...posicao, tipo: z.literal("INDICADOR"), nome: z.string().min(1).max(200) }),
  z.object({ ...posicao, tipo: z.literal("ANOTACAO"), nota: z.enum(["POSITIVO", "NEGATIVO", "ATENCAO"]), texto: z.string().max(5000) }),
]);

/** Os Relatórios Executivos (15/10/2026, Análises Gerenciais): montado em /relatorios-executivos. */
export const relatoriosExecutivosController = {
  listar(request: Request, response: Response) {
    const ano = z.coerce.number().int().min(2000).max(2100).optional().safeParse(request.query.ano);
    return responder(response, () => s.listar(ano.success ? (ano.data ?? null) : null, usuario(request)));
  },

  criar(request: Request, response: Response) {
    const corpo = z.object({ ano: z.number().int().min(2000).max(2100), mes: z.number().int().min(1).max(12), departamentos: z.array(departamento).max(7).nullish() }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Escolha o mês do relatório." });
    return responder(response, () => s.criar({ ano: corpo.data.ano, mes: corpo.data.mes, departamentos: (corpo.data.departamentos ?? null) as never }, usuario(request)), 201);
  },

  obter(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.obter(r, usuario(request))) : undefined;
  },

  dados(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.dados(r, usuario(request))) : undefined;
  },

  gravar(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    const corpo = z.object({ blocos: z.partialRecord(departamento, z.array(bloco).max(200)) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Blocos inválidos." });
    return responder(response, () => s.gravar(r, corpo.data.blocos as never, usuario(request)));
  },

  finalizar(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.mudarSituacao(r, "finalizar", usuario(request))) : undefined;
  },

  reabrir(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.mudarSituacao(r, "reabrir", usuario(request))) : undefined;
  },

  excluir(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.excluir(r, usuario(request))) : undefined;
  },
};
