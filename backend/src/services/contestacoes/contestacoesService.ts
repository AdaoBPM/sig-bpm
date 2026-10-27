import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { SituacaoContestacao } from "../../generated/prisma/enums.js";
import type { Acesso } from "../acesso/acesso.js";
import { gestaoDoCentro, MENSAGEM_SENSIVEL, podeVerMovimentos, podeVerSensiveis } from "../acesso/recorteDepartamento.js";
import { auditar } from "../auditoriaService.js";
import { classificacaoService } from "../classificacao/classificacaoService.js";
import { manualNoSinalDoBalancete } from "../dre/apuracaoUnidades.js";
import { lancamentosManuaisService } from "../lancamentosManuais/lancamentosManuaisService.js";

/**
 * As Contestações de Gastos (27/10/2026, pedido do Adão).
 *
 * No balancete de uma conta (o modal dos movimentos, na DRE do mês e nos Resultados Empresariais), quem edita a aba
 * Solicitadas contesta um item: sugere outro centro de custo e/ou outra conta de resultado (e, se quiser, o motivo). O
 * responsável pelo centro — o novo; sem centro novo, o do item — acata ou recusa (aba Recebidas): são os usuários com o
 * centro na lista deles (os Coordenadores); sem nenhum, os Gestores do departamento do centro; sem ninguém, só a
 * Controladoria, em Validações. Quem pede e é o responsável já tem a contestação acatada.
 *
 * Em Validações, Processar corrige as acatadas: na competência do item ainda aberta, no próprio balancete (a classificação
 * aplica o centro e a conta novos e guarda os do RM, para mostrar o original); na fechada, a contestação espera os
 * lançamentos manuais da aba Contestações de uma competência aberta (Importar: o estorno no centro e na conta de antes e o
 * lançamento no centro e na conta novos). Alterar Status muda a situação de qualquer uma, com a justificativa.
 */

export class RegraContestacaoError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export type UsuarioDaContestacao = { id: string; nome: string; acesso: Acesso };

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
const ABERTAS: SituacaoContestacao[] = ["PENDENTE", "ACATADA"];
export const ROTULO_SITUACAO: Record<SituacaoContestacao, string> = { PENDENTE: "Pendente", ACATADA: "Acatada", RECUSADA: "Recusada", VALIDADA: "Validada" };
/** O motivo dos lançamentos manuais das contestações (a aba Contestações dos Lançamentos). */
export const MOTIVO_CONTESTACAO = "CONTESTAÇÃO";

const centroSel = { select: { id: true, codigoRM: true, nomeRM: true, departamento: true } } as const;
const contaSel = { select: { id: true, reduzido: true, descricao: true } } as const;
const SELECAO = {
  id: true,
  numero: true,
  competenciaId: true,
  lancamentoContabilId: true,
  filial: true,
  codigoCentroCusto: true,
  nomeCentroCusto: true,
  emissao: true,
  cliForn: true,
  historico: true,
  valor: true,
  motivo: true,
  situacao: true,
  solicitanteId: true,
  solicitadaEm: true,
  respondidaPorId: true,
  respondidaEm: true,
  justificativa: true,
  justificadaPorId: true,
  justificadaEm: true,
  validadaPorId: true,
  validadaEm: true,
  formaValidacao: true,
  centroAntesId: true,
  centroNovoId: true,
  competencia: { select: { ano: true, mes: true, status: true } },
  contaBalancete: contaSel,
  centroAntes: centroSel,
  contaAntes: contaSel,
  centroNovo: centroSel,
  contaNova: contaSel,
  solicitante: { select: { nome: true } },
  lancamentosManuais: { select: { competencia: { select: { ano: true, mes: true } } }, take: 1 },
} satisfies Prisma.ContestacaoSelect;
type Linha = Prisma.ContestacaoGetPayload<{ select: typeof SELECAO }>;

/** O centro que decide a contestação: o novo; sem ele, o do item. */
const centroAlvo = (c: { centroNovoId: string | null; centroAntesId: string | null }) => c.centroNovoId ?? c.centroAntesId;

/**
 * Os responsáveis (os ids dos usuários) por cada centro: os usuários ativos, de perfil ativo, com o centro na lista
 * deles (os Coordenadores); sem nenhum, os Gestores ativos (perfil com recorte por departamento) do departamento do centro.
 */
async function responsaveisDosCentros(centroIds: string[]): Promise<Map<string, string[]>> {
  const prisma = getPrismaClient();
  const ids = [...new Set(centroIds)];
  const r = new Map<string, string[]>();
  if (!ids.length) return r;
  const [vinculos, centros, gestores] = await Promise.all([
    prisma.usuarioCentro.findMany({
      where: { centroCustoId: { in: ids }, usuario: { ativo: true, perfil: { ativo: true } } },
      select: { centroCustoId: true, usuarioId: true },
    }),
    prisma.centroCusto.findMany({ where: { id: { in: ids } }, select: { id: true, departamento: true } }),
    prisma.usuario.findMany({
      where: { ativo: true, perfil: { ativo: true, recorteDepartamento: true } },
      select: { id: true, departamentos: { select: { departamento: true } } },
    }),
  ]);
  for (const v of vinculos) r.set(v.centroCustoId, [...(r.get(v.centroCustoId) ?? []), v.usuarioId]);
  for (const c of centros) {
    if (r.get(c.id)?.length) continue;
    const g = gestaoDoCentro(c.departamento);
    const doDepartamento = g ? gestores.filter((u) => u.departamentos.some((d) => d.departamento === g)).map((u) => u.id) : [];
    if (doDepartamento.length) r.set(c.id, doDepartamento);
  }
  return r;
}

/** Os nomes dos usuários (os responsáveis, quem respondeu, quem justificou e quem validou). */
async function nomes(ids: Array<string | null | undefined>) {
  const lista = [...new Set(ids.filter((x): x is string => !!x))];
  if (!lista.length) return new Map<string, string>();
  const us = await getPrismaClient().usuario.findMany({ where: { id: { in: lista } }, select: { id: true, nome: true } });
  return new Map(us.map((u) => [u.id, u.nome]));
}

const centroTexto = (c: { codigoRM: string | null; nomeRM: string } | null) => (c ? `${c.codigoRM ?? "—"} · ${c.nomeRM}` : null);
const contaTexto = (c: { reduzido: string; descricao: string } | null) => (c ? `${c.reduzido} · ${c.descricao}` : null);

/** A contestação para as telas: o item, o antes e o depois, a situação, quem fez o quê e os responsáveis. */
async function apresentar(ls: Linha[], usuarioId: string) {
  const responsaveis = await responsaveisDosCentros(ls.map(centroAlvo).filter((x): x is string => !!x));
  const ns = await nomes([...ls.flatMap((c) => [c.respondidaPorId, c.justificadaPorId, c.validadaPorId]), ...[...responsaveis.values()].flat()]);
  return ls.map((c) => {
    const alvo = centroAlvo(c);
    const resp = alvo ? (responsaveis.get(alvo) ?? []) : [];
    const manual = c.lancamentosManuais[0]?.competencia;
    return {
      id: c.id,
      numero: c.numero,
      competencia: rotulo(c.competencia.ano, c.competencia.mes),
      competenciaFechada: c.competencia.status === "FECHADA",
      /** O item ainda está no balancete (uma reimportação pode tê-lo tirado). */
      comItem: c.lancamentoContabilId !== null,
      filial: c.filial,
      emissao: c.emissao,
      cliForn: c.cliForn,
      historico: c.historico,
      valor: c.valor.toFixed(2),
      contaBalancete: contaTexto(c.contaBalancete),
      centroAntes: centroTexto(c.centroAntes) ?? (c.codigoCentroCusto ? `${c.codigoCentroCusto} · ${c.nomeCentroCusto ?? ""}` : null),
      contaAntes: contaTexto(c.contaAntes),
      centroNovo: centroTexto(c.centroNovo),
      contaNova: contaTexto(c.contaNova),
      motivo: c.motivo,
      situacao: c.situacao,
      solicitante: c.solicitante.nome,
      solicitanteId: c.solicitanteId,
      solicitadaEm: c.solicitadaEm,
      respondidaPor: c.respondidaPorId ? (ns.get(c.respondidaPorId) ?? null) : null,
      respondidaEm: c.respondidaEm,
      justificativa: c.justificativa,
      justificadaPor: c.justificadaPorId ? (ns.get(c.justificadaPorId) ?? null) : null,
      justificadaEm: c.justificadaEm,
      validadaPor: c.validadaPorId ? (ns.get(c.validadaPorId) ?? null) : null,
      validadaEm: c.validadaEm,
      formaValidacao: c.formaValidacao,
      /** Onde a contestação virou lançamentos manuais (a competência), quando virou. */
      lancadaEm: manual ? rotulo(manual.ano, manual.mes) : null,
      responsaveis: resp.map((id) => ns.get(id) ?? id),
      /** O usuário é um dos responsáveis (acata ou recusa a pendente, na aba Recebidas). */
      souResponsavel: resp.includes(usuarioId),
    };
  });
}

/** Os centros de que o usuário é o responsável (a aba Recebidas). */
async function centrosDoResponsavel(usuarioId: string): Promise<string[]> {
  const prisma = getPrismaClient();
  const u = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { centros: { select: { centroCustoId: true } }, departamentos: { select: { departamento: true } }, perfil: { select: { recorteDepartamento: true } } },
  });
  const proprios = u.centros.map((c) => c.centroCustoId);
  if (!u.perfil.recorteDepartamento || !u.departamentos.length) return proprios;
  // Os do departamento do Gestor que não têm Coordenador.
  const deps = new Set<string>(u.departamentos.map((d) => d.departamento));
  const todos = await prisma.centroCusto.findMany({ select: { id: true, departamento: true } });
  const doDepartamento = todos.filter((c) => {
    const g = gestaoDoCentro(c.departamento);
    return g !== null && deps.has(g);
  });
  const responsaveis = await responsaveisDosCentros(doDepartamento.map((c) => c.id));
  return [...new Set([...proprios, ...doDepartamento.filter((c) => responsaveis.get(c.id)?.includes(usuarioId)).map((c) => c.id)])];
}

async function exigirContestacao(id: string) {
  const c = await getPrismaClient().contestacao.findUnique({ where: { id }, select: { ...SELECAO, competencia: { select: { id: true, ano: true, mes: true, status: true } } } });
  if (!c) throw new RegraContestacaoError(404, "Contestação não encontrada.");
  return c;
}

/** O par de lançamentos manuais de uma contestação: o estorno (centro e conta de antes) e o novo (centro e conta novos). */
async function lancamentosDaContestacao(c: {
  numero: number;
  filial: number;
  valor: Prisma.Decimal;
  historico: string | null;
  cliForn: string | null;
  centroAntesId: string | null;
  contaAntesId: string;
  centroNovoId: string | null;
  contaNovaId: string | null;
}) {
  const prisma = getPrismaClient();
  const contaNovaId = c.contaNovaId ?? c.contaAntesId;
  const centroNovoId = c.centroNovoId ?? c.centroAntesId;
  const contas = await prisma.contaResultado.findMany({
    where: { id: { in: [c.contaAntesId, contaNovaId] } },
    select: { id: true, reduzido: true, linhaDRE: { select: { grupoSigla: true } } },
  });
  const conta = (id: string) => contas.find((x) => x.id === id)!;
  // O valor no sinal da DRE (o do lançamento manual): nas receitas, o do balancete trocado.
  const naDRE = (contaId: string) => manualNoSinalDoBalancete(conta(contaId).linhaDRE?.grupoSigla ?? "", c.valor);
  const item = (c.historico || c.cliForn || "").slice(0, 120);
  return [
    {
      filial: c.filial,
      centroCustoId: c.centroAntesId,
      contaResultadoId: c.contaAntesId,
      descricao: `Contestação nº ${c.numero}: estorno${item ? ` (${item})` : ""}`,
      valor: naDRE(c.contaAntesId).neg(),
    },
    {
      filial: c.filial,
      centroCustoId: centroNovoId,
      contaResultadoId: contaNovaId,
      descricao: `Contestação nº ${c.numero}${item ? ` (${item})` : ""}`,
      valor: naDRE(contaNovaId),
    },
  ];
}

export const contestacoesService = {
  /** Contesta um item do balancete (o botão Contestar do modal). */
  async criar(d: { lancamentoId: string; centroNovoId: string | null; contaNovaId: string | null; motivo: string | null }, u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const l = await prisma.lancamentoContabil.findUnique({
      where: { id: d.lancamentoId },
      select: {
        id: true,
        competenciaId: true,
        filial: true,
        codigoCentroCusto: true,
        nomeCentroCusto: true,
        contaResultadoId: true,
        contaAdotadaId: true,
        centroCustoId: true,
        emissao: true,
        cliForn: true,
        historico: true,
        valorMovimento: true,
        linhaDRE: { select: { grupoSigla: true, descricao: true, atribuicaoSigla: true } },
        competencia: { select: { ano: true, mes: true } },
      },
    });
    if (!l) throw new RegraContestacaoError(404, "Movimento não encontrado no balancete.");
    // O que o usuário vê (o recorte e as informações sensíveis), como no balancete.
    if (l.linhaDRE && !podeVerSensiveis(u.acesso, l.linhaDRE)) throw new RegraContestacaoError(403, MENSAGEM_SENSIVEL(l.linhaDRE.descricao));
    const doCentroDele = u.acesso.recorteCentro && !!l.centroCustoId && u.acesso.centros.includes(l.centroCustoId);
    if (l.linhaDRE && !podeVerMovimentos(u.acesso, l.linhaDRE) && !doCentroDele) throw new RegraContestacaoError(403, "O movimento não é do seu recorte.");
    if (!d.centroNovoId && !d.contaNovaId) throw new RegraContestacaoError(400, "Sugira o novo centro de custo e/ou a nova conta de resultado.");
    const contaAntesId = l.contaAdotadaId ?? l.contaResultadoId;
    if (d.centroNovoId && d.centroNovoId === l.centroCustoId) throw new RegraContestacaoError(400, "O novo centro de custo é o mesmo do movimento.");
    if (d.contaNovaId && d.contaNovaId === contaAntesId) throw new RegraContestacaoError(400, "A nova conta de resultado é a mesma do movimento.");
    if (d.centroNovoId) {
      const c = await prisma.centroCusto.findUnique({ where: { id: d.centroNovoId }, select: { ativo: true, nomeRM: true } });
      if (!c) throw new RegraContestacaoError(400, "Centro de custo não encontrado.");
      if (!c.ativo) throw new RegraContestacaoError(400, `O centro de custo ${c.nomeRM} está inativo no cadastro.`);
    }
    if (d.contaNovaId) {
      const c = await prisma.contaResultado.findUnique({ where: { id: d.contaNovaId }, select: { ativo: true, reduzido: true, tipoConta: true, linhaDREId: true } });
      if (!c) throw new RegraContestacaoError(400, "Conta de resultado não encontrada.");
      if (!c.ativo || c.tipoConta !== "ANALITICA" || !c.linhaDREId) throw new RegraContestacaoError(400, `A conta ${c.reduzido} não é uma conta analítica ativa com destino na DRE.`);
    }
    const aberta = await prisma.contestacao.findFirst({ where: { lancamentoContabilId: l.id, situacao: { in: ABERTAS } }, select: { numero: true } });
    if (aberta) throw new RegraContestacaoError(409, `O movimento já tem a contestação nº ${aberta.numero} em andamento.`);
    const alvo = d.centroNovoId ?? l.centroCustoId;
    const responsaveis = alvo ? ((await responsaveisDosCentros([alvo])).get(alvo) ?? []) : [];
    // Quem pede e é o responsável pelo centro: acatada na hora.
    const acatada = responsaveis.includes(u.id);
    const agora = new Date();
    const criada = await prisma.contestacao.create({
      data: {
        competenciaId: l.competenciaId,
        lancamentoContabilId: l.id,
        filial: l.filial,
        codigoCentroCusto: l.codigoCentroCusto,
        nomeCentroCusto: l.nomeCentroCusto,
        contaBalanceteId: l.contaResultadoId,
        emissao: l.emissao,
        cliForn: l.cliForn,
        historico: l.historico,
        valor: l.valorMovimento,
        centroAntesId: l.centroCustoId,
        contaAntesId,
        centroNovoId: d.centroNovoId,
        contaNovaId: d.contaNovaId,
        motivo: d.motivo?.trim() || null,
        situacao: acatada ? "ACATADA" : "PENDENTE",
        solicitanteId: u.id,
        ...(acatada ? { respondidaPorId: u.id, respondidaEm: agora } : {}),
      },
      select: SELECAO,
    });
    const [r] = await apresentar([criada], u.id);
    await auditar({ usuarioId: u.id, usuarioNome: u.nome, acao: "CRIACAO", entidade: "contestacao", entidadeId: criada.id, depois: r, metadados: { numero: criada.numero, competencia: rotulo(l.competencia.ano, l.competencia.mes) } });
    return r;
  },

  /** As contestações de uma aba: as do usuário (Solicitadas), as dos centros dele (Recebidas) ou todas (Validações). */
  async listar(aba: "solicitadas" | "recebidas" | "validacoes", u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    let where: Prisma.ContestacaoWhereInput = {};
    if (aba === "solicitadas") where = { solicitanteId: u.id };
    if (aba === "recebidas") {
      const centros = await centrosDoResponsavel(u.id);
      where = { OR: [{ centroNovoId: { in: centros } }, { centroNovoId: null, centroAntesId: { in: centros } }] };
    }
    const ls = await prisma.contestacao.findMany({ where, select: SELECAO, orderBy: [{ solicitadaEm: "desc" }] });
    return apresentar(ls, u.id);
  },

  /** Os movimentos contestados de um balancete (o modal): a situação de cada um, para a coluna Ações. */
  async doBalancete(lancamentoIds: string[]) {
    if (!lancamentoIds.length) return new Map<string, { numero: number; situacao: SituacaoContestacao }>();
    const cs = await getPrismaClient().contestacao.findMany({
      where: { lancamentoContabilId: { in: lancamentoIds } },
      select: { lancamentoContabilId: true, numero: true, situacao: true },
      orderBy: { solicitadaEm: "asc" },
    });
    // A última de cada movimento.
    return new Map(cs.map((c) => [c.lancamentoContabilId!, { numero: c.numero, situacao: c.situacao }]));
  },

  /** O responsável acata ou recusa a pendente (aba Recebidas). */
  async responder(id: string, d: { acatar: boolean; justificativa: string | null }, u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const c = await exigirContestacao(id);
    if (c.situacao !== "PENDENTE") throw new RegraContestacaoError(409, `A contestação nº ${c.numero} está ${ROTULO_SITUACAO[c.situacao].toLowerCase()}: só a pendente se acata ou recusa.`);
    const alvo = centroAlvo(c);
    const responsaveis = alvo ? ((await responsaveisDosCentros([alvo])).get(alvo) ?? []) : [];
    if (!responsaveis.includes(u.id)) throw new RegraContestacaoError(403, "Só o responsável pelo centro de custo acata ou recusa a contestação.");
    const agora = new Date();
    const justificativa = d.justificativa?.trim() || null;
    const salva = await prisma.contestacao.update({
      where: { id },
      data: {
        situacao: d.acatar ? "ACATADA" : "RECUSADA",
        respondidaPorId: u.id,
        respondidaEm: agora,
        ...(justificativa ? { justificativa, justificadaPorId: u.id, justificadaEm: agora } : {}),
      },
      select: SELECAO,
    });
    const [r] = await apresentar([salva], u.id);
    await auditar({ usuarioId: u.id, usuarioNome: u.nome, acao: d.acatar ? "ACATAR" : "RECUSAR", entidade: "contestacao", entidadeId: id, antes: { situacao: c.situacao }, depois: r, metadados: { numero: c.numero } });
    return r;
  },

  /**
   * Alterar Status (Validações): qualquer situação, com a justificativa. A que deixa de ser validada desfaz a correção: no
   * balancete, a classificação deixa de aplicá-la (na próxima apuração); pelos lançamentos manuais, eles saem (com a
   * competência deles aberta). A que passa a validada por aqui não corrige nada: é a validação feita fora do SIG.
   */
  async alterarSituacao(id: string, d: { situacao: SituacaoContestacao; justificativa: string }, u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const c = await exigirContestacao(id);
    const justificativa = d.justificativa.trim();
    if (!justificativa) throw new RegraContestacaoError(400, "Escreva a justificativa.");
    if (c.situacao === d.situacao) throw new RegraContestacaoError(409, `A contestação nº ${c.numero} já está ${ROTULO_SITUACAO[d.situacao].toLowerCase()}.`);
    const agora = new Date();
    const desfaz = c.situacao === "VALIDADA";
    if (desfaz && c.formaValidacao === "NO_BALANCETE" && c.competencia.status === "FECHADA") {
      throw new RegraContestacaoError(409, `A correção da contestação nº ${c.numero} está na competência ${rotulo(c.competencia.ano, c.competencia.mes)}, fechada: reabra a competência antes.`);
    }
    const manuais = desfaz && c.formaValidacao === "LANCAMENTO_MANUAL" ? await prisma.lancamentoManual.findMany({ where: { contestacaoId: id }, select: { id: true, competencia: { select: { ano: true, mes: true, status: true } } } }) : [];
    const fechada = manuais.find((m) => m.competencia.status === "FECHADA");
    if (fechada) throw new RegraContestacaoError(409, `Os lançamentos da contestação nº ${c.numero} estão na competência ${rotulo(fechada.competencia.ano, fechada.competencia.mes)}, fechada: reabra a competência antes.`);
    const salva = await prisma.$transaction(async (tx) => {
      if (manuais.length) await tx.lancamentoManual.deleteMany({ where: { contestacaoId: id } });
      return tx.contestacao.update({
        where: { id },
        data: {
          situacao: d.situacao,
          justificativa,
          justificadaPorId: u.id,
          justificadaEm: agora,
          ...(d.situacao === "VALIDADA" ? { validadaPorId: u.id, validadaEm: agora, formaValidacao: null } : desfaz ? { validadaPorId: null, validadaEm: null, formaValidacao: null } : {}),
        },
        select: SELECAO,
      });
    });
    const [r] = await apresentar([salva], u.id);
    await auditar({
      usuarioId: u.id,
      usuarioNome: u.nome,
      acao: "ALTERACAO",
      entidade: "contestacao",
      entidadeId: id,
      antes: { situacao: c.situacao, formaValidacao: c.formaValidacao },
      depois: r,
      metadados: { numero: c.numero, justificativa, lancamentosExcluidos: manuais.length },
    });
    return r;
  },

  /**
   * Processar (Validações): as acatadas com o item numa competência aberta ficam validadas no balancete — a classificação
   * aplica o centro e a conta novos (já, na competência ainda não apurada; nas apuradas, na reapuração, que a situação
   * pede); as demais (competência fechada, ou o item fora do balancete reimportado) esperam a importação para os
   * lançamentos manuais de uma competência aberta.
   */
  async processar(u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const acatadas = await prisma.contestacao.findMany({
      where: { situacao: "ACATADA" },
      select: { id: true, numero: true, lancamentoContabilId: true, competencia: { select: { id: true, ano: true, mes: true, status: true, apuradaEm: true } } },
    });
    const diretas = acatadas.filter((c) => c.competencia.status !== "FECHADA" && c.lancamentoContabilId);
    const agora = new Date();
    if (diretas.length) {
      await prisma.contestacao.updateMany({
        where: { id: { in: diretas.map((c) => c.id) }, situacao: "ACATADA" },
        data: { situacao: "VALIDADA", formaValidacao: "NO_BALANCETE", validadaPorId: u.id, validadaEm: agora },
      });
    }
    // As competências ainda não apuradas se reclassificam já; as apuradas pedem reapuração.
    const competencias = new Map(diretas.map((c) => [c.competencia.id, c.competencia]));
    const reclassificadas: string[] = [];
    const reapurar: string[] = [];
    for (const comp of competencias.values()) {
      if (comp.apuradaEm) reapurar.push(rotulo(comp.ano, comp.mes));
      else {
        await classificacaoService.classificarCompetencia(comp.id);
        reclassificadas.push(rotulo(comp.ano, comp.mes));
      }
    }
    const resumo = {
      validadas: diretas.length,
      paraLancamentos: acatadas.length - diretas.length,
      reclassificadas,
      reapurar,
    };
    await auditar({ usuarioId: u.id, usuarioNome: u.nome, acao: "PROCESSAR", entidade: "contestacao", entidadeId: null, metadados: { ...resumo, numeros: diretas.map((c) => c.numero) } });
    return resumo;
  },

  /** As acatadas que não puderam ser corrigidas no balancete (o modal Importar da aba Contestações dos Lançamentos). */
  async paraLancamentos(ano: number, mes: number, u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const destino = await prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true } });
    if (!destino) throw new RegraContestacaoError(404, `A competência ${rotulo(ano, mes)} não existe.`);
    const ls = await prisma.contestacao.findMany({
      where: { situacao: "ACATADA", OR: [{ competencia: { status: "FECHADA" } }, { lancamentoContabilId: null }] },
      select: SELECAO,
      orderBy: [{ competencia: { ano: "asc" } }, { competencia: { mes: "asc" } }, { numero: "asc" }],
    });
    return apresentar(ls, u.id);
  },

  /**
   * Importar Selecionadas (aba Contestações dos Lançamentos, numa competência aberta): cada contestação vira o estorno (no
   * centro e na conta de antes) e o lançamento no centro e na conta novos, e fica validada. A que um lançamento não aceita
   * (uma combinação que nenhuma aba soma) fica acatada, com o motivo.
   */
  async importar(ano: number, mes: number, ids: string[], u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const destino = await prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true, status: true } });
    if (!destino) throw new RegraContestacaoError(404, `A competência ${rotulo(ano, mes)} não existe.`);
    if (destino.status === "FECHADA") throw new RegraContestacaoError(409, `A competência ${rotulo(ano, mes)} está fechada. Importar nela exige reabri-la.`);
    const cs = await prisma.contestacao.findMany({
      where: { id: { in: ids }, situacao: "ACATADA", OR: [{ competencia: { status: "FECHADA" } }, { lancamentoContabilId: null }] },
      select: { id: true, numero: true, filial: true, valor: true, historico: true, cliForn: true, centroAntesId: true, contaAntesId: true, centroNovoId: true, contaNovaId: true },
    });
    const importadas: number[] = [];
    const recusadas: Array<{ numero: number; motivo: string }> = [];
    for (const c of cs) {
      try {
        const pares = await lancamentosDaContestacao(c);
        await lancamentosManuaisService.criarDeContestacao(destino.id, c.id, MOTIVO_CONTESTACAO, pares, u.id);
        await prisma.contestacao.update({ where: { id: c.id }, data: { situacao: "VALIDADA", formaValidacao: "LANCAMENTO_MANUAL", validadaPorId: u.id, validadaEm: new Date() } });
        importadas.push(c.numero);
      } catch (e) {
        recusadas.push({ numero: c.numero, motivo: e instanceof Error ? e.message : String(e) });
      }
    }
    await auditar({ usuarioId: u.id, usuarioNome: u.nome, acao: "IMPORTACAO", entidade: "contestacao", entidadeId: null, metadados: { competencia: rotulo(ano, mes), importadas, recusadas } });
    return { importadas: importadas.length, recusadas };
  },

  /**
   * Desfaz a importação de uma contestação (a lixeira da aba Contestações dos Lançamentos, na competência aberta): os dois
   * lançamentos saem, e ela volta a acatada (de novo na lista do Importar).
   */
  async desfazerImportacao(id: string, u: UsuarioDaContestacao) {
    const prisma = getPrismaClient();
    const c = await exigirContestacao(id);
    const manuais = await prisma.lancamentoManual.findMany({ where: { contestacaoId: id }, select: { id: true, competencia: { select: { ano: true, mes: true, status: true } } } });
    if (!manuais.length) throw new RegraContestacaoError(404, `A contestação nº ${c.numero} não tem lançamentos.`);
    const comp = manuais[0].competencia;
    if (comp.status === "FECHADA") throw new RegraContestacaoError(409, `A competência ${rotulo(comp.ano, comp.mes)} está fechada.`);
    await prisma.$transaction([
      prisma.lancamentoManual.deleteMany({ where: { contestacaoId: id } }),
      prisma.contestacao.update({ where: { id }, data: { situacao: "ACATADA", formaValidacao: null, validadaPorId: null, validadaEm: null } }),
    ]);
    await auditar({ usuarioId: u.id, usuarioNome: u.nome, acao: "EXCLUSAO", entidade: "contestacao", entidadeId: id, metadados: { numero: c.numero, desfeita: rotulo(comp.ano, comp.mes) } });
  },

  /**
   * Depois de reimportar o balancete de uma competência (os lançamentos são gravados de novo): as contestações voltam a
   * apontar para o item, pela identidade dele (a filial, o centro e a conta do RM, a emissão, o cliente ou fornecedor, o
   * histórico e o valor). A validada no balancete cujo item não volta fica acatada de novo, com o aviso na justificativa.
   */
  async religar(competenciaId: string) {
    const prisma = getPrismaClient();
    const soltas = await prisma.contestacao.findMany({
      where: { competenciaId, lancamentoContabilId: null, situacao: { not: "RECUSADA" } },
      select: { id: true, numero: true, situacao: true, formaValidacao: true, filial: true, codigoCentroCusto: true, contaBalanceteId: true, emissao: true, cliForn: true, historico: true, valor: true },
      orderBy: { numero: "asc" },
    });
    if (!soltas.length) return { religadas: 0, semItem: 0 };
    const usados = new Set((await prisma.contestacao.findMany({ where: { competenciaId, lancamentoContabilId: { not: null } }, select: { lancamentoContabilId: true } })).map((c) => c.lancamentoContabilId!));
    let religadas = 0;
    let semItem = 0;
    for (const c of soltas) {
      const candidatos = await prisma.lancamentoContabil.findMany({
        where: {
          competenciaId,
          filial: c.filial,
          codigoCentroCusto: c.codigoCentroCusto,
          contaResultadoId: c.contaBalanceteId,
          emissao: c.emissao,
          cliForn: c.cliForn,
          historico: c.historico,
          valorMovimento: c.valor,
        },
        select: { id: true },
        orderBy: { linhaArquivo: "asc" },
      });
      const l = candidatos.find((x) => !usados.has(x.id));
      if (l) {
        usados.add(l.id);
        await prisma.contestacao.update({ where: { id: c.id }, data: { lancamentoContabilId: l.id } });
        religadas++;
      } else {
        semItem++;
        if (c.situacao === "VALIDADA" && c.formaValidacao === "NO_BALANCETE") {
          await prisma.contestacao.update({
            where: { id: c.id },
            data: {
              situacao: "ACATADA",
              formaValidacao: null,
              validadaPorId: null,
              validadaEm: null,
              justificativa: "O movimento não está no balancete reimportado: a correção no balancete foi desfeita.",
              justificadaPorId: null,
              justificadaEm: new Date(),
            },
          });
        }
      }
    }
    return { religadas, semItem };
  },
};
