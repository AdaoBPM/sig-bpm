import type { Request, Response } from "express";
import { z } from "zod";

import { anoMesSchema } from "../../schemas/importacoes/importacaoSchemas.js";
import { detalhamentoService } from "../../services/dre/detalhamentoService.js";
import { dreService, RegraDREError } from "../../services/dre/dreService.js";
import { exportacaoService, type VisaoExportacao } from "../../services/dre/exportacaoService.js";
import { obrasService } from "../../services/dre/obrasService.js";
import { volumesDaLinha } from "../../services/dre/volumesDaLinhaService.js";
import { auditar } from "../../services/auditoriaService.js";

const unidadeSchema = z.coerce.number().int().min(1).max(5);
const grupoSchema = z.string().trim().min(1).max(200).optional();
/** A obra: o código do centro de custo de obra no RM (1.98.… ou 1.99.…). */
const obraSchema = z.string().trim().regex(/^1.9[89].[0-9.]+$/).optional();

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
    if (error instanceof RegraDREError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

export const dreController = {
  async consultar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const u = unidadeSchema.safeParse(request.query.unidade ?? 1);
    if (!u.success) return response.status(400).json({ error: "Unidade inválida" });
    return responder(response, () => dreService.consultarUnidade(c.ano, c.mes, u.data, request.user!.acesso));
  },

  async consolidado(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => dreService.consultarConsolidado(c.ano, c.mes, request.user!.acesso));
  },

  /** Sem ?grupo, a lista dos agrupamentos de centros; com ele, a DRE do agrupamento. */
  async centros(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!g.success) return response.status(400).json({ error: "Centro de custo inválido" });
    return responder(response, () => (g.data ? dreService.consultarCentros(c.ano, c.mes, g.data, request.user!.acesso) : dreService.listarCentros(c.ano, c.mes, request.user!.acesso)));
  },

  /** Sem ?obra, a lista das obras (centros de obra com lançamento no mês); com ela, a DRE da obra. */
  async obras(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const o = obraSchema.safeParse(request.query.obra);
    if (!o.success) return response.status(400).json({ error: "Obra inválida" });
    return responder(response, () => (o.data ? obrasService.consultar(c.ano, c.mes, o.data, request.user!.acesso) : obrasService.listar(c.ano, c.mes, request.user!.acesso)));
  },

  /** Detalhamento de uma linha: ?linha=código e ?unidade=1..5, ?grupo=centro, ou nenhum dos dois (consolidado). */
  async detalhe(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const linha = z.string().trim().min(1).max(200).safeParse(request.query.linha);
    if (!linha.success) return response.status(400).json({ error: "Linha da DRE inválida" });
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!g.success) return response.status(400).json({ error: "Centro de custo inválido" });
    const o = obraSchema.safeParse(request.query.obra);
    if (!o.success) return response.status(400).json({ error: "Obra inválida" });
    let visao: Parameters<typeof detalhamentoService.detalhar>[3] = { consolidado: true };
    if (o.data) visao = { obra: o.data };
    else if (g.data) visao = { grupo: g.data };
    else if (request.query.unidade !== undefined) {
      const u = unidadeSchema.safeParse(request.query.unidade);
      if (!u.success) return response.status(400).json({ error: "Unidade inválida" });
      visao = { unidade: u.data };
    }
    return responder(response, () => detalhamentoService.detalhar(c.ano, c.mes, linha.data, visao, request.user!.acesso));
  },

  /** As listas que formam uma linha de volume, por obra: ?linha=código e ?unidade=1..3 (sem ela, o consolidado). */
  async volumes(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const linha = z.string().trim().min(1).max(200).safeParse(request.query.linha);
    if (!linha.success) return response.status(400).json({ error: "Linha da DRE inválida" });
    let unidade: number | null = null;
    if (request.query.unidade !== undefined) {
      const u = unidadeSchema.safeParse(request.query.unidade);
      if (!u.success) return response.status(400).json({ error: "Unidade inválida" });
      unidade = u.data;
    }
    return responder(response, () => volumesDaLinha(c.ano, c.mes, linha.data, unidade, request.user!.acesso));
  },

  async apurar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    return responder(response, () => (async () => {
      const r = await dreService.apurar(c.ano, c.mes, request.user!.sub);
      await auditar({ usuarioId: request.user!.sub, usuarioNome: request.user!.nome, acao: "APURACAO_PARCIAL", entidade: "competencia", entidadeId: `${c.ano}-${String(c.mes).padStart(2, "0")}`, metadados: { parte: "DRE" } });
      return r;
    })());
  },

  /**
   * A DRE apurada em Excel ou PDF (Passo 26): ?formato=xlsx|pdf e ?visao=
   * consolidado, todas, centros, obras ou 1..5, ?grupo= para um agrupamento de
   * centros ou ?obra= para uma obra.
   */
  async exportar(request: Request, response: Response) {
    const c = competencia(request, response);
    if (!c) return;
    const formato = z.enum(["xlsx", "pdf"]).safeParse(request.query.formato);
    if (!formato.success) return response.status(400).json({ error: "Formato inválido: use xlsx ou pdf." });
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!g.success) return response.status(400).json({ error: "Centro de custo inválido" });
    const o = obraSchema.safeParse(request.query.obra);
    if (!o.success) return response.status(400).json({ error: "Obra inválida" });
    let visao: VisaoExportacao;
    const v = String(request.query.visao ?? "consolidado");
    if (o.data) visao = { tipo: "obra", obra: o.data };
    else if (g.data) visao = { tipo: "centros", grupo: g.data };
    else if (v === "consolidado" || v === "todas") visao = { tipo: v };
    else if (v === "centros") visao = { tipo: "todosCentros" };
    else if (v === "obras") visao = { tipo: "todasObras" };
    else {
      const u = unidadeSchema.safeParse(v);
      if (!u.success) return response.status(400).json({ error: "Visão inválida: use consolidado, todas, centros, obras ou a unidade (1 a 5)." });
      visao = { tipo: "unidade", unidade: u.data };
    }
    try {
      const r = await exportacaoService.exportar(c.ano, c.mes, visao, formato.data, request.user!.nome, request.user!.acesso);
      await auditar({
        usuarioId: request.user!.sub,
        usuarioNome: request.user!.nome,
        acao: "EXPORTACAO",
        entidade: "competencia",
        entidadeId: `${c.ano}-${String(c.mes).padStart(2, "0")}`,
        metadados: { formato: formato.data, visoes: r.visoes, arquivo: r.nomeArquivo },
      });
      response.setHeader("Content-Type", r.tipo);
      response.setHeader("Content-Disposition", `attachment; filename="${r.nomeArquivo.normalize("NFD").replace(/[^\x20-\x7e]/g, "")}"; filename*=UTF-8''${encodeURIComponent(r.nomeArquivo)}`);
      return response.send(Buffer.from(r.conteudo));
    } catch (error) {
      if (error instanceof RegraDREError) return response.status(error.status).json({ error: error.message });
      throw error;
    }
  },
};
