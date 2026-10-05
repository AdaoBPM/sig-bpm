import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { classificacaoService, VALIDACOES_PENDENTES } from "../classificacao/classificacaoService.js";
import { dreService } from "../dre/dreService.js";
import { estoqueService } from "../estoque/estoqueService.js";
import { receitaPreviaService } from "../receitaPrevia/receitaPreviaService.js";
import { rateiosService } from "../volumes/rateiosService.js";
import { auditar } from "../auditoriaService.js";
import { divergenciasService } from "../divergencias/divergenciasService.js";

/**
 * Apuração congelada, fechamento e reabertura da competência (Passo 21).
 *
 * Apurar a competência refaz, em ordem, tudo o que forma o resultado do mês —
 * a classificação dos lançamentos, o saldo de estoque, a receita prévia, os
 * rateios e a DRE — e congela o retrato: a partir daí, nenhum recálculo avulso
 * (reclassificar, apurar só os rateios…) nem a recarga de um cadastro mexe nos
 * valores do mês. Só a reapuração da competência, enquanto ela está aberta ou
 * em conferência, os refaz; depois do fechamento, só a reabertura com
 * justificativa volta a permiti-la.
 *
 * A apuração guarda também um retrato das entradas (contagens e somas dos
 * lançamentos, das listas e das importações ativas). Se uma entrada mudar
 * depois — uma lista reimportada, um lançamento manual corrigido —, os valores
 * continuam congelados, e a competência passa a acusar a mudança até ser
 * reapurada; fechar exige que não haja nenhuma.
 */

export class RegraApuracaoError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
const anterior = (ano: number, mes: number) => (mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 });

async function competenciaPorAnoMes(ano: number, mes: number) {
  const c = await getPrismaClient().competencia.findUnique({
    where: { ano_mes: { ano, mes } },
    select: { id: true, status: true, apuradaEm: true, apuracoes: true, entradasApuradas: true, fechadaEm: true, fechadaPor: true },
  });
  if (!c) throw new RegraApuracaoError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  return c;
}

/** As entradas da competência que, mudando, desatualizam a apuração. */
type Retrato = Record<string, { rotulo: string; n: number; soma: string; ultima?: string | null }>;

async function retratoEntradas(competenciaId: string): Promise<Retrato> {
  const prisma = getPrismaClient();
  const where = { competenciaId };
  const q = (x: Prisma.Decimal | null | undefined) => (x ?? new Prisma.Decimal(0)).toFixed(4);
  const d = (x: Date | null | undefined) => x?.toISOString() ?? null;
  const [contabeis, manuais, receita, importacoes, ...listas] = await Promise.all([
    prisma.lancamentoContabil.aggregate({ where, _count: true, _sum: { valorMovimento: true }, _max: { criadoEm: true } }),
    prisma.lancamentoManual.aggregate({ where, _count: true, _sum: { valor: true }, _max: { atualizadoEm: true } }),
    prisma.lancamentoReceita.aggregate({ where, _count: true, _sum: { valor: true }, _max: { atualizadoEm: true } }),
    prisma.importacao.findMany({ where: { ...where, status: "CONCLUIDA", substituidaEm: null, comparacao: false }, select: { id: true }, orderBy: { id: "asc" } }),
    prisma.projeto.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.producao.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.producaoPista.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.producaoArmadura.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.producaoMetalurgia.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.expedicao.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.montagem.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.acompanhamento.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { atualizadoEm: true } }),
    prisma.medicao.aggregate({ where, _count: true, _sum: { quantidade: true }, _max: { criadoEm: true } }),
    prisma.devolucao.aggregate({ where, _count: true, _sum: { valor: true }, _max: { criadoEm: true } }),
    prisma.saida.aggregate({ where, _count: true, _sum: { valor: true }, _max: { criadoEm: true } }),
  ]);
  const NOMES = ["projetos", "produção (m³)", "produção (pistas)", "produção de armadura", "produção da metalurgia", "expedição", "montagem", "acompanhamentos", "medições", "devoluções", "saídas"];
  const r: Retrato = {
    contabeis: { rotulo: "lançamentos do balancete", n: contabeis._count, soma: q(contabeis._sum.valorMovimento), ultima: d(contabeis._max.criadoEm) },
    manuais: { rotulo: "lançamentos manuais", n: manuais._count, soma: q(manuais._sum.valor), ultima: d(manuais._max.atualizadoEm) },
    receita: { rotulo: "lançamentos de receita", n: receita._count, soma: q(receita._sum.valor), ultima: d(receita._max.atualizadoEm) },
    importacoes: { rotulo: "importações", n: importacoes.length, soma: importacoes.map((i) => i.id).join(",") },
  };
  // As listas de rateio guardam a última alteração (um registro digitado pode
  // mudar de unidade ou de etapa sem mudar a soma); as demais, só a criação.
  listas.forEach((a, i) => {
    const s = a._sum as { quantidade?: Prisma.Decimal | null; valor?: Prisma.Decimal | null };
    const m = a._max as { atualizadoEm?: Date | null; criadoEm?: Date | null };
    r[`lista${i}`] = { rotulo: `lista de ${NOMES[i]}`, n: a._count, soma: q(s.quantidade ?? s.valor), ultima: d(m.atualizadoEm ?? m.criadoEm) };
  });
  return r;
}

/**
 * Competências com apuração em andamento neste processo. Apurar, fechar e
 * reabrir a mesma competência ao mesmo tempo misturaria os retratos: um
 * fechamento no meio da reapuração, ou duas apurações intercaladas.
 */
const emApuracao = new Set<string>();
function exigirLivre(ano: number, mes: number) {
  if (emApuracao.has(`${ano}-${mes}`)) {
    throw new RegraApuracaoError(409, `A competência ${rotulo(ano, mes)} está sendo apurada agora. Espere terminar e tente de novo.`);
  }
}

/** O que mudou nas entradas desde a apuração, em frases. */
function mudancas(apurado: Retrato | null, atual: Retrato): string[] {
  if (!apurado) return [];
  const m: string[] = [];
  for (const [k, a] of Object.entries(atual)) {
    const b = apurado[k];
    if (!b) continue;
    if (k === "importacoes") {
      if (a.soma !== b.soma) m.push("Houve importação depois da apuração.");
      continue;
    }
    if (a.n !== b.n || a.soma !== b.soma || (a.ultima ?? null) !== (b.ultima ?? null)) {
      m.push(`A ${a.rotulo.startsWith("lista") ? a.rotulo : `relação de ${a.rotulo}`} mudou depois da apuração (${b.n} → ${a.n} registro(s)).`);
    }
  }
  return m;
}

/** Os quatro retratos da apuração: congela (ou descongela, para reapurar) todos de uma vez. */
async function congelar(competenciaId: string, congelado: boolean) {
  const prisma = getPrismaClient();
  const where = { competenciaId };
  await prisma.$transaction([
    prisma.resultadoApurado.updateMany({ where, data: { congelado } }),
    prisma.receitaPrevia.updateMany({ where, data: { congelado } }),
    prisma.volumeOperacional.updateMany({ where, data: { congelado } }),
    prisma.estoqueSaldo.updateMany({ where: { ...where, importacaoId: null }, data: { congelado } }),
  ]);
}

export const apuracaoService = {
  /**
   * O andamento de cada competência, para a lista de competências: balancete
   * importado, lançamentos sem classificação ou com pendência, e se a apuração
   * ficou para trás das entradas (só nas não fechadas; a fechada não muda).
   */
  async andamento(competencias: { id: string; ano: number; mes: number; status: string; apuradaEm: Date | null }[]) {
    const prisma = getPrismaClient();
    const ids = competencias.map((c) => c.id);
    const [balancetes, lancamentos, pendentes, naoClassificados] = await Promise.all([
      prisma.importacao.findMany({
        where: { competenciaId: { in: ids }, tipo: "BALANCETE", status: "CONCLUIDA", substituidaEm: null, comparacao: false },
        select: { competenciaId: true },
      }),
      prisma.lancamentoContabil.groupBy({ by: ["competenciaId"], where: { competenciaId: { in: ids } }, _count: true }),
      prisma.lancamentoContabil.groupBy({ by: ["competenciaId"], where: { competenciaId: { in: ids }, validacao: { in: VALIDACOES_PENDENTES } }, _count: true }),
      prisma.lancamentoContabil.groupBy({ by: ["competenciaId"], where: { competenciaId: { in: ids }, classificadoEm: null }, _count: true }),
    ]);
    const conta = (g: { competenciaId: string; _count: number }[]) => new Map(g.map((x) => [x.competenciaId, x._count]));
    const [nLanc, nPend, nSem] = [conta(lancamentos), conta(pendentes), conta(naoClassificados)];
    const comBalancete = new Set(balancetes.map((b) => b.competenciaId));
    const apuradaEm = new Map(competencias.map((c) => [`${c.ano}-${c.mes}`, c.apuradaEm]));

    const r = new Map<string, { balancete: boolean; lancamentos: number; pendencias: number; semClassificacao: number; desatualizada: boolean }>();
    for (const c of competencias) {
      let desatualizada = false;
      if (c.apuradaEm && c.status !== "FECHADA") {
        const { entradasApuradas } = await prisma.competencia.findUniqueOrThrow({ where: { id: c.id }, select: { entradasApuradas: true } });
        desatualizada = mudancas(entradasApuradas as Retrato | null, await retratoEntradas(c.id)).length > 0;
        // O mês anterior reapurado depois muda o saldo inicial do estoque (como na situação).
        const a = anterior(c.ano, c.mes);
        const antes = apuradaEm.has(`${a.ano}-${a.mes}`)
          ? apuradaEm.get(`${a.ano}-${a.mes}`)
          : (await prisma.competencia.findUnique({ where: { ano_mes: a }, select: { apuradaEm: true } }))?.apuradaEm;
        if (antes && antes > c.apuradaEm) desatualizada = true;
      }
      r.set(c.id, { balancete: comBalancete.has(c.id), lancamentos: nLanc.get(c.id) ?? 0, pendencias: nPend.get(c.id) ?? 0, semClassificacao: nSem.get(c.id) ?? 0, desatualizada });
    }
    return r;
  },

  /** A situação da competência: estado, apuração, o que mudou desde ela e o que falta para fechar. */
  async situacao(ano: number, mes: number) {
    const prisma = getPrismaClient();
    const c = await competenciaPorAnoMes(ano, mes);
    const a = anterior(ano, mes);
    const [detalhe, atual, pendentes, naoClassificados, reaberturas, mesAnterior] = await Promise.all([
      prisma.competencia.findUniqueOrThrow({
        where: { id: c.id },
        select: { usuarioApuracao: { select: { nome: true } }, usuarioFechamento: { select: { nome: true } } },
      }),
      retratoEntradas(c.id),
      prisma.lancamentoContabil.count({ where: { competenciaId: c.id, validacao: { in: VALIDACOES_PENDENTES } } }),
      prisma.lancamentoContabil.count({ where: { competenciaId: c.id, classificadoEm: null } }),
      prisma.reaberturaCompetencia.findMany({
        where: { competenciaId: c.id },
        orderBy: { reabertaEm: "desc" },
        select: { justificativa: true, reabertaEm: true, fechamentoAnteriorEm: true, usuario: { select: { nome: true } } },
      }),
      prisma.competencia.findUnique({ where: { ano_mes: a }, select: { apuradaEm: true } }),
    ]);
    const apurada = c.apuradaEm !== null;
    const mudou = apurada ? mudancas(c.entradasApuradas as Retrato | null, atual) : [];
    if (apurada && mesAnterior?.apuradaEm && mesAnterior.apuradaEm > c.apuradaEm!) {
      mudou.push(`A competência ${rotulo(a.ano, a.mes)} foi reapurada depois; o saldo inicial do estoque pode ter mudado.`);
    }
    const motivosNaoFechar: string[] = [];
    if (c.status === "FECHADA") motivosNaoFechar.push("A competência já está fechada.");
    if (!apurada) motivosNaoFechar.push("A competência ainda não foi apurada.");
    if (mudou.length) motivosNaoFechar.push("As entradas mudaram depois da apuração: reapure antes de fechar.");
    if (pendentes) motivosNaoFechar.push(`Há ${pendentes} lançamento(s) com pendência de classificação.`);
    if (naoClassificados) motivosNaoFechar.push(`Há ${naoClassificados} lançamento(s) sem classificação.`);
    return {
      competencia: { ano, mes, status: c.status },
      apurada,
      apuradaEm: c.apuradaEm,
      apuradaPor: detalhe.usuarioApuracao?.nome ?? null,
      apuracoes: c.apuracoes,
      fechadaEm: c.fechadaEm,
      fechadaPor: detalhe.usuarioFechamento?.nome ?? null,
      mudancas: mudou,
      pendenciasClassificacao: pendentes,
      podeApurar: c.status !== "FECHADA",
      podeFechar: motivosNaoFechar.length === 0,
      motivosNaoFechar,
      podeReabrir: c.status === "FECHADA",
      reaberturas: reaberturas.map((r) => ({ justificativa: r.justificativa, reabertaEm: r.reabertaEm, reabertaPor: r.usuario.nome, fechamentoAnteriorEm: r.fechamentoAnteriorEm })),
    };
  },

  /**
   * Apura a competência inteira e congela o resultado. Recusa competência
   * fechada. Se uma etapa falhar, a competência fica sem apuração válida — o
   * retrato anterior já foi em parte refeito — e o erro diz em qual etapa parou.
   */
  async apurar(ano: number, mes: number, usuarioId: string) {
    const prisma = getPrismaClient();
    const c = await competenciaPorAnoMes(ano, mes);
    if (c.status === "FECHADA") throw new RegraApuracaoError(409, `A competência ${rotulo(ano, mes)} está fechada. Reapurar exige reabri-la.`);
    exigirLivre(ano, mes);
    emApuracao.add(`${ano}-${mes}`);
    try {
      return await this.apurarSemTrava(c, ano, mes, usuarioId);
    } finally {
      emApuracao.delete(`${ano}-${mes}`);
    }
  },

  /** A apuração em si: chamada só por apurar(), com a trava da competência. */
  async apurarSemTrava(c: Awaited<ReturnType<typeof competenciaPorAnoMes>>, ano: number, mes: number, usuarioId: string) {
    const prisma = getPrismaClient();
    // O retrato das entradas é o do início: o que chegar durante a apuração (uma
    // lista que termina de importar na fila) não entrou no cálculo e tem de
    // aparecer como mudança depois dela.
    const retrato = await retratoEntradas(c.id);
    await congelar(c.id, false);
    const etapas: Array<{ etapa: string; resumo: unknown }> = [];
    const avisos: string[] = [];
    let etapa = "classificação";
    try {
      etapas.push({ etapa, resumo: await classificacaoService.classificarCompetencia(c.id) });
      etapa = "saldo de estoque";
      const inicial = await prisma.estoqueSaldo.count({ where: { competenciaId: c.id, importacaoId: { not: null } } });
      if (!inicial) {
        const e = await estoqueService.apurar(ano, mes);
        etapas.push({ etapa, resumo: e });
        avisos.push(...((e as { avisos?: string[] }).avisos ?? []));
      }
      etapa = "receita prévia";
      const r = await receitaPreviaService.apurar(ano, mes);
      etapas.push({ etapa, resumo: r });
      avisos.push(...((r as { avisos?: string[] }).avisos ?? []));
      etapa = "rateios";
      etapas.push({ etapa, resumo: await rateiosService.apurar(ano, mes) });
      etapa = "DRE";
      const d = await dreService.apurar(ano, mes, usuarioId);
      etapas.push({ etapa, resumo: d });
      avisos.push(...d.avisos);
    } catch (e) {
      await prisma.competencia.update({ where: { id: c.id }, data: { apuradaEm: null, apuradaPor: null, entradasApuradas: Prisma.DbNull } });
      const msg = e instanceof Error ? e.message : String(e);
      await auditar({
        usuarioId,
        acao: "APURACAO",
        entidade: "competencia",
        entidadeId: c.id,
        antes: { status: c.status, apuradaEm: c.apuradaEm, apuracoes: c.apuracoes },
        depois: { status: c.status, apuradaEm: null },
        metadados: { competencia: rotulo(ano, mes), resultado: "interrompida", etapa, erro: msg },
      });
      throw new RegraApuracaoError(409, `A apuração de ${rotulo(ano, mes)} parou na etapa "${etapa}": ${msg} A competência ficou sem apuração válida; corrija e apure de novo.`);
    }

    await congelar(c.id, true);
    const agora = new Date();
    await prisma.competencia.update({
      where: { id: c.id },
      data: {
        apuradaEm: agora,
        apuradaPor: usuarioId,
        apuracoes: { increment: 1 },
        entradasApuradas: retrato as Prisma.InputJsonValue,
        ...(c.status === "ABERTA" ? { status: "EM_CONFERENCIA" as const } : {}),
      },
    });
    // A receita foi refeita com os preços vigentes: as divergências de preço da competência se resolvem.
    const precosResolvidos = await divergenciasService.resolverPrecosPorReapuracao(c.id, usuarioId);
    await auditar({
      usuarioId,
      acao: "APURACAO",
      entidade: "competencia",
      entidadeId: c.id,
      antes: { status: c.status, apuradaEm: c.apuradaEm, apuracoes: c.apuracoes },
      depois: { status: c.status === "ABERTA" ? "EM_CONFERENCIA" : c.status, apuradaEm: agora, apuracoes: c.apuracoes + 1, divergenciasDePrecoResolvidas: precosResolvidos },
      metadados: { competencia: rotulo(ano, mes), resultado: "concluída", etapas: etapas.map((e) => e.etapa) },
    });
    return { apuradaEm: agora, apuracoes: c.apuracoes + 1, etapas: etapas.map((e) => e.etapa), avisos: [...new Set(avisos)] };
  },

  /** Fecha a competência: exige apuração em dia e nenhuma pendência de classificação. */
  async fechar(ano: number, mes: number, usuarioId: string) {
    exigirLivre(ano, mes);
    const s = await this.situacao(ano, mes);
    if (!s.podeFechar) throw new RegraApuracaoError(409, `A competência ${rotulo(ano, mes)} não pode ser fechada: ${s.motivosNaoFechar.join(" ")}`);
    const c = await competenciaPorAnoMes(ano, mes);
    const fechadaEm = new Date();
    await getPrismaClient().competencia.update({
      where: { id: c.id },
      data: { status: "FECHADA", fechadaEm, fechadaPor: usuarioId },
    });
    await auditar({
      usuarioId,
      acao: "FECHAMENTO",
      entidade: "competencia",
      entidadeId: c.id,
      antes: { status: c.status, fechadaEm: null },
      depois: { status: "FECHADA", fechadaEm },
      metadados: { competencia: rotulo(ano, mes), apuradaEm: c.apuradaEm, apuracoes: c.apuracoes },
    });
    return this.situacao(ano, mes);
  },

  /**
   * Reabre uma competência fechada, com justificativa. Os valores continuam
   * como foram apurados (congelados) até a competência ser reapurada.
   */
  async reabrir(ano: number, mes: number, justificativa: string, usuarioId: string) {
    const c = await competenciaPorAnoMes(ano, mes);
    if (c.status !== "FECHADA") throw new RegraApuracaoError(409, `A competência ${rotulo(ano, mes)} não está fechada.`);
    const texto = justificativa.trim();
    if (texto.length < 15) throw new RegraApuracaoError(400, "A justificativa da reabertura precisa explicar o motivo (ao menos 15 caracteres).");
    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.reaberturaCompetencia.create({
        data: { competenciaId: c.id, justificativa: texto, reabertaPor: usuarioId, fechamentoAnteriorEm: c.fechadaEm, fechamentoAnteriorPor: c.fechadaPor },
      }),
      prisma.competencia.update({ where: { id: c.id }, data: { status: "ABERTA", fechadaEm: null, fechadaPor: null } }),
    ]);
    await auditar({
      usuarioId,
      acao: "REABERTURA",
      entidade: "competencia",
      entidadeId: c.id,
      antes: { status: "FECHADA", fechadaEm: c.fechadaEm, fechadaPor: c.fechadaPor },
      depois: { status: "ABERTA", fechadaEm: null },
      metadados: { competencia: rotulo(ano, mes), justificativa: texto },
    });
    return this.situacao(ano, mes);
  },
};
