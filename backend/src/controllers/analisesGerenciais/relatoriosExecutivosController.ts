import { createReadStream } from "node:fs";

import type { Request, Response } from "express";
import { z } from "zod";

import { temPermissao } from "../../middlewares/verificarPermissao.js";
import { CODIGO_ADMINISTRADOR } from "../../services/acesso/acesso.js";
import { CHAVES_DAS_ABAS, FONTES_DO_TEXTO, NOME_DA_FOTO, NOME_DO_VIDEO, RelatorioExecutivoError, SITES_DE_VIDEO, relatoriosExecutivosService as s, type UsuarioDoRelatorio } from "../../services/analisesGerenciais/relatoriosExecutivosService.js";

/**
 * Os ajustes de uma imagem (21/10/2026): brilho e saturação de 0 a 200%, matiz de −180° a 180°, desfoque até 20 px e
 * transparência até 100%; a borda (espessura até 20 px e a cor) e o sombreamento centralizado (intensidade até 100% e
 * desfoque até 60 px), desde 22/10/2026.
 */
const ajustesDeImagem = z.object({
  brilho: z.number().min(0).max(200).optional(),
  matiz: z.number().min(-180).max(180).optional(),
  saturacao: z.number().min(0).max(200).optional(),
  desfoque: z.number().min(0).max(20).optional(),
  transparencia: z.number().min(0).max(100).optional(),
  bordaEspessura: z.number().min(0).max(20).optional(),
  bordaCor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  sombraIntensidade: z.number().min(0).max(100).optional(),
  sombraDesfoque: z.number().min(0).max(60).optional(),
});

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
    if (error instanceof RelatorioExecutivoError) return response.status(error.status).json({ error: error.message, ...(error.codigo ? { codigo: error.codigo, detalhes: error.detalhes } : {}) });
    throw error;
  }
}

function id(request: Request, response: Response) {
  const r = z.string().uuid().safeParse(request.params.id);
  if (!r.success) response.status(400).json({ error: "Relatório inválido." });
  return r.success ? r.data : null;
}

const departamento = z.enum(CHAVES_DAS_ABAS as [(typeof CHAVES_DAS_ABAS)[number], ...(typeof CHAVES_DAS_ABAS)[number][]]);
function aba(request: Request, response: Response) {
  const r = departamento.safeParse(request.params.departamento);
  if (!r.success) response.status(400).json({ error: "Aba inválida." });
  return r.success ? r.data : null;
}
const zoomDoCard = z.union([z.literal(1.25), z.literal(1.5), z.literal(2), z.literal(2.5), z.literal(3)]).optional();
const posicao = { id: z.string().min(1).max(60), x: z.number().int().min(0).max(24), y: z.number().int().min(0).max(2000), w: z.number().int().min(1).max(24), h: z.number().int().min(1).max(200) };
// A fonte, o espaçamento entre as linhas e a formatação de um nível do Sumário (20/10/2026).
const fonteDoTexto = z.enum(FONTES_DO_TEXTO);
const espacamento = z.number().min(0.5).max(2).optional();
const estiloDoSumario = z.object({ negrito: z.boolean().optional(), italico: z.boolean().optional(), sublinhado: z.boolean().optional(), tamanho: z.number().int().min(8).max(144).optional(), cor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), fonte: fonteDoTexto.optional() });
/** O corte de uma imagem (27/10/2026): o zoom (1 a 4) e a posição (0 a 1), como na Imagem de Fundo. */
const recorte = z.object({ zoom: z.number().min(1).max(4), x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const bloco = z.discriminatedUnion("tipo", [
  // O Zoom do card (30/10/2026): 125% a 300% (sem ele, 100%).
  z.object({ ...posicao, tipo: z.literal("PAINEL"), aba: z.enum(["resultados", "performance"]), quadro: z.string().max(200), titulo: z.string().max(200), sigla: z.string().max(60), comGrafico: z.boolean(), soAcumulado: z.boolean().optional(), tipoGrafico: z.enum(["barras", "area"]).optional(), comRotulos: z.boolean().optional(), cores: z.enum(["padrao", "daltonismo"]).optional(), zoom: zoomDoCard }),
  z.object({ ...posicao, tipo: z.literal("INDICADOR"), nome: z.string().min(1).max(200), grafico: z.enum(["MESES", "ACUMULADO"]).optional(), tipoGrafico: z.enum(["barras", "area"]).optional(), comRotulos: z.boolean().optional(), zoom: zoomDoCard }),
  z.object({ ...posicao, tipo: z.literal("ANOTACAO"), nota: z.enum(["POSITIVO", "NEGATIVO", "ATENCAO"]), texto: z.string().max(5000), titulo: z.string().max(120).optional(), html: z.string().max(30000).optional(), tamanhoTitulo: z.number().int().min(8).max(48).optional(), fonteTitulo: fonteDoTexto.optional(), espacamento }),
  z.object({ ...posicao, tipo: z.literal("FOTO"), arquivo: z.union([z.literal(""), z.string().regex(NOME_DA_FOTO)]), legenda: z.string().max(500), proporcao: z.number().positive().max(50), legendaHtml: z.string().max(5000).optional(), livre: z.boolean().optional(), ajustes: ajustesDeImagem.optional(), recorte: recorte.optional() }),
  // O vídeo (20/10/2026): o arquivo enviado ou o link de um dos sites aceitos (vazios, o quadro esperando o vídeo).
  z.object({
    ...posicao,
    tipo: z.literal("VIDEO"),
    origem: z.enum(["ARQUIVO", "LINK"]),
    arquivo: z.union([z.literal(""), z.string().regex(NOME_DO_VIDEO)]),
    url: z.union([z.literal(""), z.string().max(2000).regex(SITES_DE_VIDEO)]),
    legenda: z.string().max(500),
    proporcao: z.number().positive().max(50),
    legendaHtml: z.string().max(5000).optional(),
  }),
  // O Texto Livre e o Sumário (20/10/2026); as telas do Sumário são da Introdução às performances (sem a Capa e o Encerramento).
  z.object({ ...posicao, tipo: z.literal("TEXTO"), texto: z.string().max(5000), html: z.string().max(30000).optional(), espacamento }),
  // A tabela de Resultados (22/10/2026): a visão, o nível, as linhas escolhidas e os meses anteriores recolhidos.
  z.object({ ...posicao, tipo: z.literal("TABELA"), visao: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]), nivel: z.union([z.literal(1), z.literal(2), z.literal(3)]), linhas: z.array(z.string().min(1).max(200)).max(1000).optional(), recolhido: z.boolean().optional(), colunas: z.object({ unitario: z.boolean(), diferenca: z.boolean(), atingimento: z.boolean(), eficiencia: z.boolean() }).optional() }),
  z.object({ ...posicao, tipo: z.literal("SUMARIO"), listar: z.enum(["TELAS", "TELAS_E_SLIDES"]), telas: z.array(departamento.exclude(["CAPA", "ENCERRAMENTO"])).max(CHAVES_DAS_ABAS.length), linha: z.enum(["PONTOS", "TRACOS", "LINHA", "NENHUM"]).optional(), estilos: z.object({ telas: estiloDoSumario.optional(), slides: estiloDoSumario.optional() }).optional() }),
]);
/** A Imagem de Fundo da página (20/10/2026): a foto, a proporção, o zoom (1 a 4) e a posição (0 a 1). */
const fundo = z.object({ arquivo: z.string().regex(NOME_DA_FOTO), proporcao: z.number().positive().max(50), zoom: z.number().min(1).max(4), x: z.number().min(0).max(1), y: z.number().min(0).max(1), ajustes: ajustesDeImagem.optional() });

/** Os Relatórios Executivos (15/10/2026, Análises Gerenciais): montado em /relatorios-executivos. */
export const relatoriosExecutivosController = {
  listar(request: Request, response: Response) {
    return responder(response, () => s.listar(usuario(request)));
  },

  criar(request: Request, response: Response) {
    const corpo = z.object({ ano: z.number().int().min(2000).max(2100), mes: z.number().int().min(1).max(12), importarDe: z.string().uuid().nullish(), manterImagensEAnotacoes: z.boolean().optional() }).safeParse(request.body);
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

  configuracoes(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.configuracoes(r, usuario(request))) : undefined;
  },

  gravarConfiguracoes(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    const corpo = z.object({ cenarioComparadoId: z.string().uuid().nullable() }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Escolha o cenário de comparação." });
    return responder(response, () => s.gravarConfiguracoes(r, corpo.data, usuario(request)));
  },

  resultados(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    const visao = Number(request.query.visao);
    if (![0, 1, 2, 3, 4, 5].includes(visao)) return response.status(400).json({ error: "Visão inválida." });
    return responder(response, () => s.resultados(r, visao as 0 | 1 | 2 | 3 | 4 | 5));
  },

  gravarAba(request: Request, response: Response) {
    const r = id(request, response);
    const d = r ? aba(request, response) : null;
    if (!r || !d) return;
    // As páginas da aba (16/10/2026), cada uma com os blocos dela.
    // `versao` e `forcar` (23/10/2026): a conferência de que ninguém gravou a aba depois que o usuário a abriu.
    const corpo = z
      .object({
        paginas: z.array(z.object({ id: z.string().min(1).max(40), nome: z.string().max(60).optional(), blocos: z.array(bloco).max(200), fundo: fundo.optional(), transicao: z.enum(["ESMAECER", "ROLAR_VERTICAL", "ROLAR_HORIZONTAL"]).optional(), avancarApos: z.number().int().min(1).max(3600).optional() })).min(1).max(30),
        versao: z.string().max(40).optional(),
        forcar: z.boolean().optional(),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Páginas ou blocos inválidos." });
    return responder(response, () => s.gravarAba(r, d, corpo.data.paginas, usuario(request), { versao: corpo.data.versao, forcar: corpo.data.forcar }));
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

  /** Uma foto nova (16/10/2026): o arquivo vai cru no corpo, com o tipo no Content-Type. */
  copiarArquivos(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    const corpo = z.object({ de: z.string().uuid(), arquivos: z.array(z.string().max(60)).min(1).max(200) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Informe o relatório de origem e os arquivos." });
    return responder(response, () => s.copiarArquivos(r, corpo.data.de, corpo.data.arquivos, usuario(request)));
  },

  salvarFoto(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    if (!Buffer.isBuffer(request.body) || request.body.length === 0) return response.status(400).json({ error: "O arquivo da foto está vazio." });
    return responder(response, () => s.salvarFoto(r, request.body as Buffer, String(request.headers["content-type"] ?? ""), usuario(request)), 201);
  },

  async lerFoto(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    try {
      const f = await s.lerFoto(r, String(request.params.arquivo));
      response.setHeader("Content-Type", f.tipo);
      response.setHeader("Cache-Control", "private, max-age=86400");
      return response.send(f.conteudo);
    } catch (error) {
      if (error instanceof RelatorioExecutivoError) return response.status(error.status).json({ error: error.message, ...(error.codigo ? { codigo: error.codigo, detalhes: error.detalhes } : {}) });
      throw error;
    }
  },

  /** Um vídeo novo (20/10/2026): o arquivo vai cru no corpo, com o tipo no Content-Type, e é gravado enquanto chega. */
  salvarVideo(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    const tamanho = Number(request.headers["content-length"]);
    return responder(response, () => s.salvarVideo(r, request, String(request.headers["content-type"] ?? ""), Number.isFinite(tamanho) ? tamanho : null, usuario(request)), 201);
  },

  /** Um vídeo (20/10/2026), em partes (o cabeçalho Range), para o player avançar e recuar sem baixar o arquivo inteiro. */
  async lerVideo(request: Request, response: Response) {
    const r = id(request, response);
    if (!r) return;
    try {
      const v = await s.lerVideo(r, String(request.params.arquivo));
      response.setHeader("Content-Type", v.tipo);
      response.setHeader("Accept-Ranges", "bytes");
      response.setHeader("Cache-Control", "private, max-age=86400");
      const intervalo = /^bytes=(\d*)-(\d*)$/.exec(String(request.headers.range ?? ""));
      if (!intervalo || (!intervalo[1] && !intervalo[2])) {
        response.setHeader("Content-Length", String(v.tamanho));
        return createReadStream(v.caminho).pipe(response);
      }
      // "bytes=início-fim", "bytes=início-" ou "bytes=-últimos".
      const inicio = intervalo[1] ? Number(intervalo[1]) : Math.max(0, v.tamanho - Number(intervalo[2]));
      const fim = intervalo[1] && intervalo[2] ? Math.min(Number(intervalo[2]), v.tamanho - 1) : v.tamanho - 1;
      if (inicio >= v.tamanho || inicio > fim) {
        response.setHeader("Content-Range", `bytes */${v.tamanho}`);
        return response.status(416).end();
      }
      response.status(206);
      response.setHeader("Content-Range", `bytes ${inicio}-${fim}/${v.tamanho}`);
      response.setHeader("Content-Length", String(fim - inicio + 1));
      return createReadStream(v.caminho, { start: inicio, end: fim }).pipe(response);
    } catch (error) {
      if (error instanceof RelatorioExecutivoError) return response.status(error.status).json({ error: error.message, ...(error.codigo ? { codigo: error.codigo, detalhes: error.detalhes } : {}) });
      throw error;
    }
  },

  excluir(request: Request, response: Response) {
    const r = id(request, response);
    return r ? responder(response, () => s.excluir(r, usuario(request))) : undefined;
  },
};
