import type { Request, Response } from "express";
import { z } from "zod";

import { CODIGO_ADMINISTRADOR } from "../../services/acesso/acesso.js";
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
const visualizacaoSchema = z.enum(["PARTICULAR", "PUBLICA"]).optional();
const tipoSchema = z.enum(["SINTETICO", "ANALITICO"]);

/** Quem pede; o Administrador (Editar no Controle de Usuários) vê também os cenários particulares. */
const usuario = (request: Request) => ({ id: request.user!.sub, nome: request.user!.nome, admin: request.user!.perfil.codigo === CODIGO_ADMINISTRADOR });

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

const unidadeSchema = z.coerce.number().int().min(1).max(3);

export const cenariosController = {
  /** As premissas de uma unidade de um cenário analítico (?unidade=1 a 3). */
  premissas(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const u = unidadeSchema.safeParse(request.query.unidade);
    if (!u.success) return response.status(400).json({ error: "Unidade inválida." });
    return responder(response, () => cenariosService.premissas(c, u.data as 1 | 2 | 3, usuario(request)));
  },

  centros(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.centros(c, usuario(request))) : undefined;
  },

  /** As contas de um grupo de centros (?grupo=, o nome da Controladoria). */
  centro(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const grupo = z.string().trim().min(1).max(200).safeParse(request.query.grupo);
    if (!grupo.success) return response.status(400).json({ error: "Grupo de centros de custo inválido." });
    return responder(response, () => cenariosService.centro(c, grupo.data, usuario(request)));
  },

  gravarCentro(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z
      .object({
        grupo: z.string().trim().min(1).max(200),
        alteracoes: z.array(z.object({ linha: z.string().min(1).max(200), mes: z.number().int().min(1).max(12), valor: z.number().finite().nullable() })).min(1).max(5000),
        origem: z
          .object({ tipo: z.enum(["MARCADOS", "VALOR"]), modo: z.enum(["PERCENTUAL", "ABSOLUTO", "DIGITADO"]), reajuste: z.number().finite().nullable(), replicado: z.boolean() })
          .optional(),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Valores inválidos." });
    return responder(response, () => cenariosService.gravarCentro(c, corpo.data.grupo, corpo.data.alteracoes, usuario(request), corpo.data.origem));
  },

  investimentos(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.investimentos(c, usuario(request))) : undefined;
  },

  extraOperacional(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.extraOperacional(c, usuario(request))) : undefined;
  },

  /** Os valores mensais da Depreciação Base (tipo BASE) ou do Extra-Operacional (EXTRA). */
  gravarMensais(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z
      .object({
        tipo: z.enum(["BASE", "EXTRA"]),
        alteracoes: z.array(z.object({ linha: z.string().min(1).max(200), mes: z.number().int().min(1).max(12), valor: z.number().finite().nullable() })).min(1).max(5000),
        origem: z
          .object({ tipo: z.enum(["MARCADOS", "VALOR"]), modo: z.enum(["PERCENTUAL", "ABSOLUTO", "DIGITADO"]), reajuste: z.number().finite().nullable(), replicado: z.boolean() })
          .optional(),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Valores inválidos." });
    return responder(response, () => cenariosService.gravarMensais(c, corpo.data.tipo, corpo.data.alteracoes, usuario(request), corpo.data.origem));
  },

  /** Novo investimento (POST), alteração (PUT /:investimentoId) ou exclusão (DELETE /:investimentoId). */
  gravarInvestimento(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const investimentoId = request.params.investimentoId ? idSchema.safeParse(request.params.investimentoId) : null;
    if (investimentoId && !investimentoId.success) return response.status(400).json({ error: "Investimento inválido." });
    if (request.method === "DELETE") return responder(response, () => cenariosService.gravarInvestimento(c, investimentoId!.data!, null, usuario(request)));
    const corpo = z
      .object({
        unidade: z.number().int().min(1).max(4),
        descricao: z.string().trim().min(1, "Descreva o investimento.").max(200),
        ganhoPrevisto: z.string().trim().max(500).nullish().transform((x) => x || null),
        receitaBrutaPrevista: z.number().finite().min(0).nullable(),
        inicio: z.number().int().min(1).max(12),
        valorTotal: z.number().finite().positive("O valor total precisa ser maior que zero."),
        valorPosUso: z.number().finite().min(0),
        vidaUtil: z.number().int().min(1, "A vida útil é de pelo menos 1 mês.").max(600),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Investimento inválido." });
    return responder(response, () => cenariosService.gravarInvestimento(c, investimentoId?.data ?? null, corpo.data, usuario(request)), investimentoId ? 200 : 201);
  },

  rateios(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.rateios(c, usuario(request))) : undefined;
  },

  gravarPremissas(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z
      .object({
        unidade: unidadeSchema,
        alteracoes: z
          .array(z.object({ venda: z.enum(["GLOBAL", "MERCANTIL"]), chave: z.string().min(1).max(200), mes: z.number().int().min(1).max(12), valor: z.number().finite().nullable() }))
          .min(1)
          .max(5000),
        origem: z
          .object({ tipo: z.enum(["MARCADOS", "VALOR"]), modo: z.enum(["PERCENTUAL", "ABSOLUTO", "DIGITADO"]), reajuste: z.number().finite().nullable(), replicado: z.boolean() })
          .optional(),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Premissas inválidas." });
    return responder(response, () => cenariosService.gravarPremissas(c, corpo.data.unidade as 1 | 2 | 3, corpo.data.alteracoes, usuario(request), corpo.data.origem));
  },

  /** A lista de um tipo (?tipo=SINTETICO, o padrão, ou ANALITICO). */
  listar(request: Request, response: Response) {
    const tipo = tipoSchema.default("SINTETICO").safeParse(request.query.tipo);
    if (!tipo.success) return response.status(400).json({ error: "Tipo de cenário inválido." });
    return responder(response, () => cenariosService.listar(usuario(request), tipo.data));
  },

  obter(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.obter(c, usuario(request))) : undefined;
  },

  criar(request: Request, response: Response) {
    const corpo = z
      .object({ nome: nomeSchema, ano: anoSchema, descricao: descricaoSchema, copiarDe: idSchema.nullish().transform((x) => x ?? null), visualizacao: visualizacaoSchema, tipo: tipoSchema.default("SINTETICO") })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Dados inválidos." });
    return responder(response, () => cenariosService.criar(corpo.data, usuario(request)), 201);
  },

  atualizar(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z.object({ nome: nomeSchema, descricao: descricaoSchema, visualizacao: visualizacaoSchema }).safeParse(request.body);
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
    return responder(response, () => cenariosService.analisar({ cenarioId: q.data.cenarioId ?? null, nomeArquivo: q.data.nomeArquivo, conteudo: request.body as Buffer }, usuario(request)));
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
        visualizacao: visualizacaoSchema,
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Dados inválidos." });
    const d = corpo.data;
    return responder(response, () =>
      cenariosService.importar({ hash: d.hash, nomeArquivo: d.nomeArquivo, cenarioId: d.cenarioId ?? null, nome: d.nome || null, ano: d.ano ?? null, descricao: d.descricao, visualizacao: d.visualizacao }, usuario(request)),
    );
  },

  resultados(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const visao = visaoSchema.safeParse(request.query.visao ?? 0);
    if (!visao.success) return response.status(400).json({ error: "Visão inválida." });
    return responder(response, () => cenariosService.resultados(c, visao.data as 0 | 1 | 2 | 3 | 4 | 5, usuario(request)));
  },

  /** O Painel de Bordo do cenário: ?ate=1..12 (dezembro, sem ele). */
  painel(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const ate = z.coerce.number().int().min(1).max(12).default(12).safeParse(request.query.ate);
    if (!ate.success) return response.status(400).json({ error: "Mês inválido." });
    // Só as abas permitidas (Resultados, Performance; 14/10/2026).
    const base = String(response.locals.areaDoCenario ?? "cenarios");
    return responder(response, async () => {
      const r = await cenariosService.painel(c, ate.data, usuario(request));
      return { ...r, abas: r.abas.filter((a) => request.user!.permissions.includes(`${base}_painel.${a.chave}:ler`)) };
    });
  },

  /**
   * Os indicadores do cenário, só os das abas permitidas (14/10/2026): as Metas são todos; os Indicadores de Resultados,
   * os da DRE; os Indicadores Manuais, os manuais (no analítico, também pela aba das Premissas).
   */
  indicadores(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const base = String(response.locals.areaDoCenario ?? "cenarios");
    const tem = (p: string) => request.user!.permissions.includes(`${p}:ler`);
    const todas = tem(`${base}_indicadores.metas`);
    const resultados = todas || tem(`${base}_indicadores.resultados`);
    const manuais = todas || tem(`${base}_indicadores.manuais`) || (base === "cenarios_analiticos" && tem(`${base}_premissas.manuais`));
    return responder(response, async () => {
      const r = await cenariosService.indicadores(c, usuario(request));
      return { ...r, indicadores: todas ? r.indicadores : r.indicadores.filter((i) => (i.classe === "MANUAL" ? manuais : i.classe === "RESULTADO" ? resultados : false)) };
    });
  },

  /** A visão da DRE para a edição: ?visao=0..5. */
  edicao(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const visao = visaoSchema.safeParse(request.query.visao ?? 0);
    if (!visao.success) return response.status(400).json({ error: "Visão inválida." });
    return responder(response, () => cenariosService.edicao(c, visao.data as 0 | 1 | 2 | 3 | 4 | 5, usuario(request)));
  },

  /** Valores mensais de contas de uma unidade: { visao: 1..5, alteracoes: [{ linha, mes, valor }] }. */
  gravarValores(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z
      .object({
        visao: z.number().int().min(1).max(5),
        alteracoes: z.array(z.object({ linha: z.string().min(1).max(200), mes: z.number().int().min(1).max(12), valor: z.number().finite() })).min(1).max(5000),
        origem: z
          .object({
            tipo: z.enum(["MARCADOS", "VALOR"]),
            modo: z.enum(["PERCENTUAL", "ABSOLUTO", "DIGITADO"]),
            reajuste: z.number().finite().nullable(),
            replicado: z.boolean(),
          })
          .optional(),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Valores inválidos." });
    return responder(response, () => cenariosService.gravarValores(c, corpo.data.visao, corpo.data.alteracoes, usuario(request), corpo.data.origem));
  },

  /** O histórico de reajustes do cenário. */
  reajustes(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.reajustes(c, usuario(request))) : undefined;
  },

  /** A referência pelo resultado realizado: { ano, modo: MES_A_MES | MEDIA, de?, ate? } (as competências fechadas dele). */
  referenciaRealizado(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z
      .object({ ano: anoSchema, modo: z.enum(["MES_A_MES", "MEDIA"]).default("MES_A_MES"), de: z.number().int().min(1).max(12).optional(), ate: z.number().int().min(1).max(12).optional() })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Exercício ou período inválido." });
    const { ano, ...opcoes } = corpo.data;
    return responder(response, () => cenariosService.referenciaRealizado(c, ano, usuario(request), opcoes));
  },

  /** Congelar Versão: trava o cenário. */
  congelarVersao(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.congelarVersao(c, usuario(request))) : undefined;
  },

  /** Reabrir Versão: destrava a versão congelada. */
  reabrirVersao(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.reabrirVersao(c, usuario(request))) : undefined;
  },

  /** Criar Revisão: a cópia da versão congelada numa versão nova, aberta para edição. */
  criarRevisao(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.criarRevisao(c, usuario(request)), 201) : undefined;
  },

  /** O comparativo do cenário: o comparado, as opções e as variações máximas dos totais. */
  comparativo(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.comparativo(c, usuario(request))) : undefined;
  },

  /** Grava o comparativo: { comparadoComId (nulo desliga), limites: { código do total: % ou nulo } }. */
  gravarComparativo(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z
      .object({ comparadoComId: idSchema.nullable(), limites: z.record(z.string(), z.number().finite().min(0, "A variação máxima não pode ser negativa.").max(100000).nullable()) })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: corpo.error.issues[0]?.message ?? "Comparativo inválido." });
    return responder(response, () => cenariosService.gravarComparativo(c, corpo.data, usuario(request)));
  },

  /** As contas acima da variação máxima do comparativo, por visão, com as justificativas. */
  justificativas(request: Request, response: Response) {
    const c = id(request, response);
    return c ? responder(response, () => cenariosService.justificativas(c, usuario(request))) : undefined;
  },

  /** Grava a justificativa: { visao, linha (código), texto } (o texto vazio apaga). */
  gravarJustificativa(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z.object({ visao: visaoSchema, linha: z.string().min(1).max(200), texto: z.string().trim().max(2000) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Justificativa inválida." });
    return responder(response, () => cenariosService.gravarJustificativa(c, corpo.data, usuario(request)));
  },

  gravarLotacao(request: Request, response: Response) {
    const corpo = z
      .object({
        grupo: z.string().min(1),
        alteracoes: z.array(z.object({ mes: z.number().int().min(1).max(12), valor: z.number().finite().nullable() })).min(1).max(12),
        origem: z.object({ tipo: z.enum(["MARCADOS", "VALOR"]), modo: z.enum(["PERCENTUAL", "ABSOLUTO", "DIGITADO"]), reajuste: z.number().nullable(), replicado: z.boolean() }).optional(),
      })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ message: "Quadro de lotação inválido." });
    return responder(response, () => cenariosService.gravarLotacao(String(request.params.id), corpo.data.grupo, corpo.data.alteracoes, usuario(request), corpo.data.origem));
  },

  referenciaCenario(request: Request, response: Response) {
    const corpo = z.object({ origemId: z.string().min(1) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ message: "Escolha o cenário de referência." });
    return responder(response, () => cenariosService.referenciaCenario(String(request.params.id), corpo.data.origemId, usuario(request)));
  },

  correspondencias(_request: Request, response: Response) {
    return responder(response, () => cenariosService.correspondencias());
  },

  gravarCorrespondencias(request: Request, response: Response) {
    const corpo = z
      .object({ itens: z.array(z.object({ filial: z.number().int().nullable(), tarefa: z.string().max(120), linha: z.string().min(1) })).max(500) })
      .safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ message: "Correspondência inválida." });
    return responder(response, () => cenariosService.gravarCorrespondencias(corpo.data.itens, usuario(request)));
  },

  salvarManual(request: Request, response: Response) {
    const c = id(request, response);
    if (!c) return;
    const corpo = z.object({ nome: z.string().trim().min(1).max(200), valores: z.array(z.number().finite().nullable()).length(12) }).safeParse(request.body);
    if (!corpo.success) return response.status(400).json({ error: "Valores inválidos." });
    return responder(response, () => cenariosService.salvarManual(c, corpo.data.nome, corpo.data.valores, usuario(request)));
  },
};
