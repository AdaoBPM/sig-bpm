import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { totaisDaCompetencia } from "../volumes/volumesService.js";
import { apurarUnidades, type LinhaEstrutura } from "./apuracaoUnidades.js";
import { apurarCentros, consolidar } from "./consolidacao.js";

/** Erro de regra — vira 400/404/409 no controller, não 500. */
export class RegraDREError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

async function competenciaPorAnoMes(ano: number, mes: number) {
  const c = await getPrismaClient().competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true, status: true } });
  if (!c) throw new RegraDREError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  return c;
}

async function estrutura(): Promise<LinhaEstrutura[]> {
  const linhas = await getPrismaClient().linhaDRE.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      codigo: true,
      tipo: true,
      grupo: true,
      grupoSigla: true,
      atribuicao: true,
      descricao: true,
      expressao: true,
      unidades: { select: { unidadeNegocio: { select: { codigo: true } } } },
    },
  });
  return linhas.map((l) => ({ ...l, unidades: l.unidades.map((u) => u.unidadeNegocio.codigo) }));
}

type ValorGravado = { linhaDREId: string; valor: Prisma.Decimal; composicao: Prisma.JsonValue; apuradoEm: Date; congelado: boolean };

/** As linhas da estrutura com valor gravado (e as seções), na ordem da DRE. */
function montarLinhas(linhas: LinhaEstrutura[], valores: ValorGravado[]) {
  const porLinha = new Map(valores.map((v) => [v.linhaDREId, v]));
  return {
    apuradoEm: valores[0]?.apuradoEm ?? null,
    congelado: valores.some((v) => v.congelado),
    linhas: linhas
      .filter((l) => l.tipo === "SECAO" || porLinha.has(l.id))
      .map((l) => ({
        codigo: l.codigo,
        tipo: l.tipo,
        grupo: l.grupo,
        grupoSigla: l.grupoSigla,
        descricao: l.descricao,
        valor: porLinha.get(l.id)?.valor.toFixed(2) ?? null,
        composicao: porLinha.get(l.id)?.composicao ?? null,
      })),
  };
}

/**
 * Agrupamento do centro na visão por centro de custo: a coluna CENTRO DE CUSTO
 * (CONTROLADORIA) do cadastro (decisão do usuário de 30/09/2026). O centro é
 * achado pelo código RM; sem essa coluna preenchida, fica num grupo à parte.
 */
export const SEM_AGRUPAMENTO = "(sem centro de custo da controladoria)";
export const grupoDoCentro = (cc: { nomeControladoria: string | null }) => cc.nomeControladoria?.trim() || SEM_AGRUPAMENTO;

export const dreService = {
  /**
   * Apura a DRE das cinco unidades a partir do que já está apurado no mês — a
   * classificação dos lançamentos, os rateios e a receita prévia — e dos
   * lançamentos manuais; depois, a consolidada (a soma das unidades) e a visão
   * por centro de custo (os lançamentos de cada centro, antes do rateio).
   * Grava tudo com a composição de cada valor, substituindo a apuração anterior.
   */
  async apurar(ano: number, mes: number, usuarioId?: string) {
    const c = await competenciaPorAnoMes(ano, mes);
    if (c.status === "FECHADA") throw new RegraDREError(409, `A competência ${rotulo(ano, mes)} está fechada. Reapurar exige reabri-la.`);
    const prisma = getPrismaClient();
    if (await prisma.resultadoApurado.count({ where: { competenciaId: c.id, congelado: true } })) {
      throw new RegraDREError(409, `A DRE de ${rotulo(ano, mes)} está congelada.`);
    }
    const [linhas, lancamentos, manuais, volumes, receitas, totais, pendentes] = await Promise.all([
      estrutura(),
      prisma.lancamentoContabil.findMany({
        where: { competenciaId: c.id },
        select: { filial: true, centroCustoId: true, linhaDREId: true, balde: true, alocacao: true, valorMovimento: true },
      }),
      prisma.lancamentoManual.findMany({ where: { competenciaId: c.id }, select: { linhaDREId: true, balde: true, valor: true } }),
      prisma.volumeOperacional.findMany({ where: { competenciaId: c.id }, select: { percentual: true, regraRateio: { select: { chave: true, destino: true } } } }),
      prisma.receitaPrevia.findMany({ where: { competenciaId: c.id }, select: { natureza: true, receitaBruta: true, receitaLiquida: true, unidadeNegocio: { select: { codigo: true } } } }),
      totaisDaCompetencia(c.id),
      prisma.lancamentoContabil.count({ where: { competenciaId: c.id, classificadoEm: null } }),
    ]);
    if (lancamentos.length === 0) throw new RegraDREError(409, `A competência ${rotulo(ano, mes)} não tem balancete importado.`);
    if (pendentes > 0) throw new RegraDREError(409, `Há ${pendentes} lançamento(s) sem classificação. Classifique a competência antes de apurar.`);
    if (volumes.length === 0) throw new RegraDREError(409, `Os rateios de ${rotulo(ano, mes)} não foram apurados.`);
    if (receitas.length === 0) throw new RegraDREError(409, `A receita prévia de ${rotulo(ano, mes)} não foi apurada.`);

    const { resultados, avisos } = apurarUnidades({
      linhas,
      lancamentos: lancamentos.map((l) => ({ filial: l.filial, linhaDREId: l.linhaDREId, balde: l.balde, alocacao: l.alocacao, valor: l.valorMovimento })),
      manuais: manuais.map((m) => ({ linhaDREId: m.linhaDREId, balde: m.balde, valor: m.valor })),
      percentuais: new Map(volumes.map((v) => [`${v.regraRateio.chave}|${v.regraRateio.destino}`, v.percentual])),
      totais: new Map(totais.map((t) => [t.codigo as string, t.quantidade])),
      receitas: receitas.map((r) => ({ unidade: r.unidadeNegocio.codigo, natureza: r.natureza, receitaBruta: r.receitaBruta, receitaLiquida: r.receitaLiquida })),
    });
    const consolidado = consolidar(linhas, resultados);
    const centros = apurarCentros(
      linhas,
      lancamentos.map((l) => ({ centroCustoId: l.centroCustoId, linhaDREId: l.linhaDREId, valor: l.valorMovimento })),
    );

    const unidades = new Map((await prisma.unidadeNegocio.findMany({ select: { id: true, codigo: true } })).map((u) => [u.codigo, u.id]));
    const comum = { competenciaId: c.id, apuradoEm: new Date(), apuradoPor: usuarioId ?? null };
    const json = (x: unknown) => (x ?? Prisma.DbNull) as Prisma.InputJsonValue;
    const dados: Prisma.ResultadoApuradoCreateManyInput[] = [
      ...resultados.map((r) => ({ ...comum, unidadeNegocioId: unidades.get(r.unidade)!, linhaDREId: r.linhaId, valor: r.valor, composicao: json(r.composicao) })),
      ...consolidado.map((r) => ({ ...comum, linhaDREId: r.linhaId, valor: r.valor, composicao: json(r.composicao) })),
      ...centros.map((r) => ({ ...comum, centroCustoId: r.centroCustoId, linhaDREId: r.linhaId, valor: r.valor, composicao: json(r.composicao) })),
    ];
    await prisma.$transaction(
      async (tx) => {
        await tx.resultadoApurado.deleteMany({ where: { competenciaId: c.id } });
        for (let i = 0; i < dados.length; i += 500) await tx.resultadoApurado.createMany({ data: dados.slice(i, i + 500) });
      },
      { timeout: 120_000 },
    );
    return { resultados: resultados.length, consolidado: consolidado.length, centros: centros.length, avisos };
  },

  /** A DRE apurada de uma unidade, na ordem da estrutura. */
  async consultarUnidade(ano: number, mes: number, unidade: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    const [linhas, valores] = await Promise.all([
      estrutura(),
      getPrismaClient().resultadoApurado.findMany({
        where: { competenciaId: c.id, centroCustoId: null, unidadeNegocio: { codigo: unidade } },
        select: { linhaDREId: true, valor: true, composicao: true, apuradoEm: true, congelado: true },
      }),
    ]);
    return { competencia: { ano, mes, status: c.status }, unidade, ...montarLinhas(linhas, valores) };
  },

  /** A DRE consolidada, na ordem da estrutura. */
  async consultarConsolidado(ano: number, mes: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    const [linhas, valores] = await Promise.all([
      estrutura(),
      getPrismaClient().resultadoApurado.findMany({
        where: { competenciaId: c.id, unidadeNegocioId: null, centroCustoId: null },
        select: { linhaDREId: true, valor: true, composicao: true, apuradoEm: true, congelado: true },
      }),
    ]);
    return { competencia: { ano, mes, status: c.status }, ...montarLinhas(linhas, valores) };
  },

  /**
   * Os agrupamentos de centros de custo com lançamento apurado no mês, com o
   * total dos lançamentos de cada um.
   */
  async listarCentros(ano: number, mes: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    const valores = await getPrismaClient().resultadoApurado.findMany({
      where: { competenciaId: c.id, centroCustoId: { not: null }, linhaDRE: { tipo: "ITEM" } },
      select: { valor: true, apuradoEm: true, centroCusto: { select: { id: true, nomeRM: true, nomeControladoria: true, departamento: true } } },
    });
    const grupos = new Map<string, { departamentos: Set<string>; centros: Set<string>; total: Prisma.Decimal }>();
    for (const v of valores) {
      const cc = v.centroCusto!;
      const g = grupoDoCentro(cc);
      const x = grupos.get(g) ?? { departamentos: new Set<string>(), centros: new Set<string>(), total: new Prisma.Decimal(0) };
      if (cc.departamento) x.departamentos.add(cc.departamento);
      x.centros.add(cc.id);
      x.total = x.total.plus(v.valor);
      grupos.set(g, x);
    }
    return {
      competencia: { ano, mes, status: c.status },
      apuradoEm: valores[0]?.apuradoEm ?? null,
      grupos: [...grupos]
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
        .map(([grupo, g]) => ({ grupo, departamentos: [...g.departamentos].sort(), centros: g.centros.size, total: g.total.toFixed(2) })),
    };
  },

  /** A DRE de um agrupamento de centros de custo: a soma dos centros, com a parte de cada um. */
  async consultarCentros(ano: number, mes: number, grupo: string) {
    const c = await competenciaPorAnoMes(ano, mes);
    const [linhas, valores] = await Promise.all([
      estrutura(),
      getPrismaClient().resultadoApurado.findMany({
        where: { competenciaId: c.id, centroCustoId: { not: null } },
        select: {
          linhaDREId: true,
          valor: true,
          apuradoEm: true,
          congelado: true,
          centroCusto: { select: { id: true, codigoRM: true, nomeRM: true, nomeControladoria: true } },
        },
      }),
    ]);
    const doGrupo = valores.filter((v) => grupoDoCentro(v.centroCusto!) === grupo);
    if (doGrupo.length === 0) throw new RegraDREError(404, `Nenhum valor apurado para o centro de custo ${grupo} em ${rotulo(ano, mes)}.`);
    type Parte = { codigoRM: string | null; nome: string; valor: string };
    const porLinha = new Map<string, { valor: Prisma.Decimal; centros: Parte[] }>();
    for (const v of doGrupo) {
      const a = porLinha.get(v.linhaDREId) ?? { valor: new Prisma.Decimal(0), centros: [] };
      a.valor = a.valor.plus(v.valor);
      a.centros.push({ codigoRM: v.centroCusto!.codigoRM, nome: v.centroCusto!.nomeRM, valor: v.valor.toFixed(2) });
      porLinha.set(v.linhaDREId, a);
    }
    const porCodigo = (a: { codigoRM: string | null }, b: { codigoRM: string | null }) => (a.codigoRM ?? "").localeCompare(b.codigoRM ?? "");
    const centros = new Map(doGrupo.map((v) => [v.centroCusto!.id, { codigoRM: v.centroCusto!.codigoRM, nome: v.centroCusto!.nomeRM }]));
    return {
      competencia: { ano, mes, status: c.status },
      grupo,
      centros: [...centros.values()].sort(porCodigo),
      apuradoEm: doGrupo[0].apuradoEm,
      congelado: doGrupo.some((v) => v.congelado),
      linhas: linhas
        .filter((l) => l.tipo === "SECAO" || porLinha.has(l.id))
        .map((l) => {
          const a = porLinha.get(l.id);
          return {
            codigo: l.codigo,
            tipo: l.tipo,
            grupo: l.grupo,
            grupoSigla: l.grupoSigla,
            descricao: l.descricao,
            valor: a?.valor.toFixed(2) ?? null,
            composicao: a && centros.size > 1 ? { regra: "Soma dos centros do agrupamento", centros: a.centros.sort(porCodigo) } : null,
          };
        }),
    };
  },
};
