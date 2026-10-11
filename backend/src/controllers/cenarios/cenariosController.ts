import type { Request, Response } from "express";
import { z } from "zod";

import { CenarioError, cenariosService } from "../../services/cenarios/cenariosService.js";

const idSchema = z.string().uuid();
const nomeSchema = z.string().trim().min(1, "Dê um nome ao cenário.").max(120);
const descricaoSchema = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((d) => d || null);
const anoSchema = z.coerce.number().int().min(2020).max(2100);
const visaoSchema = z.coerce.number().int().min(0).max(5);
const marcacaoSchema = z.enum(["ORCAMENTO_EMPRESARIAL", "RESULTADOS_ANTERIORES", "RESULTADOS_VENDIDOS"]).nullable();

const usuario = (request: Request) => ({ id: request.user!.sub, nome: request.user!.nome });

async function responder(response: Response, fn: () => Promise<unknown>, status = 200) {
  try {
    return response.status(status).json({ data: await fn() });
  } catch (error) {
    if (error instanceof CenarioError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

/** O id da rota; sem ele válido, 400. */
function id(request: Request, response: Response) {
  const r = idSchema.safeParse(request.params.id);
  if (!r.success) response.status(400).json({ error: "Cenário inválido." });
  return r.success ? r.data : null;
}

export const cenariosController = {
  listar: (_request: Request, response: Response) => responder(response, () => cenariosService.listar()),

  obter(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.obter(c)) : undefined;
  },

  criar(request: Request, response: Response) {
    const corpo = z.object({ nome: nomeSchema, ano: anoSchema, descricao: descricaoSchema, copiarDe: idSchema.nullish().transform((x) => x ?? null) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Dados inválidos." });
    return responder(response, () => cenariosService.criar(corpo.data, usuario(request)), 201);
  },

  atualizar(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z.object({ nome: nomeSchema, descricao: descricaoSchema }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Dados inválidos." });
    return responder(response, () => cenariosService.atualizar(c, corpo.data, usuario(request)));
  },

  excluir(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.excluir(c, usuario(request))) : undefined;
  },

  marcar(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z.object({ marcacao: marcacaoSchema }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Marcação inválida." });
    return responder(response, () => cenariosService.marcar(c, corpo.data.marcacao, usuario(request)));
  },

  /** Importação, passo 1: o arquivo vai cru no corpo; ?nomeArquivo= e, para importar num cenário, ?cenarioId=. Devolve a prévia. */
  analisar(request: Request, response: Response) {
    const q = z.object({ nomeArquivo: z.string().trim().min(1).max(255), cenarioId: idSchema.optional() }).safeParse(request.query);
    if (!q.success) return response.status(400).json({ error: "Dados inválidos." });
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) return response.status(400).json({ error: "O arquivo enviado está vazio." });
    return responder(response, () => cenariosService.analisar({ cenarioId: q.data.cenarioId ?? null, nomeArquivo: q.data.nomeArquivo, conteudo: request.body as Buffer }));
  },

  /** Importação, passo 2 (o usuário confirmou): o hash da prévia e o destino — o cenário ou o nome do novo. */
  importar(request: Request, response: Response) {
    const corpo = z
      .object({
        hash: z.string().regex(/^[0-9a-f]{64}$/),
        nomeArquivo: z.string().trim().min(1).max(255),
        cenarioId: idSchema.nullish(),
        nome: z.string().trim().max(120).nullish(),
        ano: anoSchema.nullish(),
        descricao: descricaoSchema,
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Dados inválidos." });
    const d = corpo.data;
    return responder(response, () =>
      cenariosService.importar({ hash: d.hash, nomeArquivo: d.nomeArquivo, cenarioId: d.cenarioId ?? null, nome: d.nome || null, ano: d.ano ?? null, descricao: d.descricao }, usuario(request)),
    );
  },

  resultados(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const visao = visaoSchema.safeParse(request.query.visao ?? 0);
    if (!visao.success) return response.status(400).json({ error: "Visão inválida." });
    return responder(response, () => cenariosService.resultados(c, visao.data as 0 | 1 | 2 | 3 | 4 | 5));
  },

  indicadores(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.indicadores(c)) : undefined;
  },

  salvarManual(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z.object({ nome: z.string().trim().min(1).max(200), valores: z.array(z.number().finite().nullable()).length(12) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Valores inválidos." });
    return responder(response, () => cenariosService.salvarManual(c, corpo.data.nome, corpo.data.valores, usuario(request)));
  },
};
