import type { Request, Response } from "express";
import { z } from "zod";

import { auditar } from "../../services/auditoriaService.js";
import { exportacaoRelatoriosService, type EscopoResultados } from "../../services/relatorios/exportacaoRelatoriosService.js";
import { indicadoresService } from "../../services/relatorios/indicadoresService.js";
import { RelatorioError, resultadosService } from "../../services/relatorios/resultadosService.js";

const anoSchema = z.coerce.number().int().min(2025).max(2100);
const ateSchema = z.coerce.number().int().min(1).max(12).optional();
const visaoSchema = z.union([z.literal("centros"), z.coerce.number().int().min(0).max(5)]);
const grupoSchema = z.string().trim().min(1).max(200).optional();

async function responder(response: Response, fn: () => Promise<unknown>) {
  try {
    return response.json({ data: await fn() });
  } catch (error) {
    if (error instanceof RelatorioError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

const formatoSchema = z.enum(["xlsx", "pdf"]);

/** Envia o arquivo gerado, com o nome em UTF-8, e registra a exportação na auditoria. */
async function enviarArquivo(request: Request, response: Response, relatorio: string, gerar: () => Promise<{ nomeArquivo: string; tipo: string; conteudo: Uint8Array; visoes: string[] }>) {
  try {
    const r = await gerar();
    await auditar({
      usuarioId: request.user!.sub,
      usuarioNome: request.user!.nome,
      acao: "EXPORTACAO",
      entidade: "relatorio",
      entidadeId: relatorio,
      metadados: { formato: request.query.formato, ano: request.query.ano, ate: request.query.ate, visoes: r.visoes, arquivo: r.nomeArquivo },
    });
    response.setHeader("Content-Type", r.tipo);
    response.setHeader("Content-Disposition", `attachment; filename="${r.nomeArquivo.normalize("NFD").replace(/[^ -~]/g, "")}"; filename*=UTF-8''${encodeURIComponent(r.nomeArquivo)}`);
    return response.send(Buffer.from(r.conteudo));
  } catch (error) {
    if (error instanceof RelatorioError) return response.status(error.status).json({ error: error.message });
    throw error;
  }
}

/** ?ano= e ?ate= (o último mês; sem ele, o último apurado). */
function periodo(request: Request, response: Response) {
  const ano = anoSchema.safeParse(request.query.ano);
  const ate = ateSchema.safeParse(request.query.ate || undefined);
  if (!ano.success || !ate.success) {
    response.status(400).json({ error: "Exercício ou mês inválido" });
    return null;
  }
  return { ano: ano.data, ate: ate.data };
}

export const relatoriosController = {
  /** ?visao=0..5 (0 Consolidado) ou ?visao=centros: sem ?grupo, a lista dos agrupamentos; com ele, o agrupamento. */
  async resultados(request: Request, response: Response) {
    const p = periodo(request, response);
    if (!p) return;
    const v = visaoSchema.safeParse(request.query.visao ?? 0);
    const g = grupoSchema.safeParse(request.query.grupo);
    if (!v.success || !g.success) return response.status(400).json({ error: "Visão inválida" });
    const acesso = request.user!.acesso;
    if (v.data === "centros") {
      return responder(response, () => (g.data ? resultadosService.centros(p.ano, g.data, p.ate, acesso) : resultadosService.listarCentros(p.ano, p.ate, acesso)));
    }
    const visao = v.data as 0 | 1 | 2 | 3 | 4 | 5;
    return responder(response, () => resultadosService.unidade(p.ano, visao, p.ate));
  },

  /**
   * ?formato=xlsx|pdf e ?escopo=atual (a visão de ?visao=0..5, ou o centro de ?grupo=), unidades (as seis visões) ou
   * centros (todos os agrupamentos que o usuário alcança): uma visão por aba (Excel) ou por página (PDF).
   */
  async exportarResultados(request: Request, response: Response) {
    const p = periodo(request, response);
    if (!p) return;
    const formato = formatoSchema.safeParse(request.query.formato);
    if (!formato.success) return response.status(400).json({ error: "Formato inválido: use xlsx ou pdf." });
    const g = grupoSchema.safeParse(request.query.grupo);
    const v = visaoSchema.safeParse(request.query.visao ?? 0);
    const escopo = String(request.query.escopo ?? "atual");
    let e: EscopoResultados;
    if (escopo === "unidades") e = { tipo: "unidades" };
    else if (escopo === "centros") e = { tipo: "centros" };
    else if (g.success && g.data) e = { tipo: "centro", grupo: g.data };
    else if (v.success && v.data !== "centros") e = { tipo: "visao", visao: v.data as 0 | 1 | 2 | 3 | 4 | 5 };
    else return response.status(400).json({ error: "Visão inválida: use ?visao=0..5, ?grupo= ou ?escopo=unidades|centros." });
    return enviarArquivo(request, response, "resultados", () =>
      exportacaoRelatoriosService.resultados(p.ano, p.ate, e, formato.data, request.user!.nome, request.user!.acesso),
    );
  },

  async exportarIndicadores(request: Request, response: Response) {
    const p = periodo(request, response);
    if (!p) return;
    const formato = formatoSchema.safeParse(request.query.formato);
    if (!formato.success) return response.status(400).json({ error: "Formato inválido: use xlsx ou pdf." });
    return enviarArquivo(request, response, "indicadores", () => exportacaoRelatoriosService.indicadores(p.ano, p.ate, formato.data, request.user!.nome));
  },

  async indicadores(request: Request, response: Response) {
    const p = periodo(request, response);
    if (!p) return;
    return responder(response, () => indicadoresService.listar(p.ano, p.ate));
  },
};
