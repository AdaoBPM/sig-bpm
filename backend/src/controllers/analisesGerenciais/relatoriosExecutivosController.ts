import type { Request, Response } from "express";
import { z } from "zod";

import { temPermissao } from "../../middlewares/verificarPermissao.js";
import { CODIGO_ADMINISTRADOR } from "../../services/acesso/acesso.js";
import { DEPARTAMENTOS, RelatorioExecutivoError, relatoriosExecutivosService as s, type UsuarioDoRelatorio } from "../../services/analisesGerenciais/relatoriosExecutivosService.js";

/** O usuário da requisição: se edita a tela e os departamentos do recorte (sem recorte, nulo: todos). */
const usuario = (request: Request): UsuarioDoRelatorio => ({
  id: request.user!.sub,
  nome: request.user!.nome,
  admin: request.user!.perfil.codigo === CODIGO_ADMINISTRADOR,
  edita: temPermissao(request, "relatorios_executivos:editar"),
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

const departamento = z.enum(DEPARTAMENTOS as [(typeof DEPARTAMENTOS)[number], ...(typeof DEPARTAMENTOS)[number][]]);
function aba(request: Request, response: Response) {
  const r = departamento.safeParse(request.params.departamento);
  if (!r.success) response.status(400).json({ error: "Aba inválida." });
  return r.success ? r.data : null;
}
const posicao = { id: z.string().min(1).max(60), x: z.number().int().min(0).max(24), y: z.number().int().min(0).max(2000), w: z.number().int().min(1).max(24), h: z.number().int().min(1).max(200) };
const bloco = z.discriminatedUnion("tipo", [
  z.object({ ...posicao, tipo: z.literal("PAINEL"), aba: z.enum(["resultados", "performance"]), quadro: z.string().max(200), titulo: z.string().max(200), sigla: z.string().max(60), comGrafico: z.boolean() }),
  z.object({ ...posicao, tipo: z.literal("INDICADOR"), nome: z.string().min(1).max(200) }),
  z.object({ ...posicao, tipo: z.literal("ANOTACAO"), nota: z.enum(["POSITIVO", "NEGATIVO", "ATENCAO"]), texto: z.string().max(5000) }),
]);

/** Os Relatórios Executivos (15/10/2026, Análises Gerenciais): montado em /relatorios-executivos. */
export const relatoriosExecutivosController = {
  listar(request: Request, response: Response) {
    return responder(response, () => s.listar(usuario(request)));
  },

  criar(request: Request, response: Response) {
    const corpo = z.object({ ano: z.number().int().min(2000).max(2100), mes: z.number().int().min(1).max(12) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Escolha a competência do relatório." });
    return responder(response, () => s.criar(corpo.data, usuario(request)), 201);
  },

  obter(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.obter(r, usuario(request))) : undefined;
  },

  dados(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.dados(r)) : undefined;
  },

  gravarAba(request: Request, response: Response) {
    const r = id(request, response);
    const d = r ? aba(request, response) : null;
    if (!r || !d) return;
    const corpo = z.object({ blocos: z.array(bloco).max(200) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Blocos inválidos." });
    return responder(response, () => s.gravarAba(r, d, corpo.data.blocos, usuario(request)));
  },

  finalizarAba(request: Request, response: Response) {
    const r = id(request, response);
    const d = r ? aba(request, response) : null;
    return r && d ? responder(response, () => s.mudarAba(r, d, "finalizar", usuario(request))) : undefined;
  },

  reabrirAba(request: Request, response: Response) {
    const r = id(request, response);
    const d = r ? aba(request, response) : null;
    return r && d ? responder(response, () => s.mudarAba(r, d, "reabrir", usuario(request))) : undefined;
  },

  excluir(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.excluir(r, usuario(request))) : undefined;
  },
};
