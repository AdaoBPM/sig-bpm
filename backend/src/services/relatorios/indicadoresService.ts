import { getPrismaClient } from "../../config/prisma.js";
import { acumular, INDICADORES, type DadosDoMes } from "./indicadores.js";
import { acumularMeta } from "./metasOrcamento.js";
import { mesesDoExercicio } from "./resultadosService.js";

/**
 * Os dados de um mês: a DRE de todas as visões e os volumes congelados dos
 * rateios (só no mês apurado; senão NaN, e o indicador fica sem valor) e os
 * indicadores importados (com ou sem apuração).
 */
export async function dadosDoMes(competenciaId: string, apurado: boolean): Promise<DadosDoMes> {
  const prisma = getPrismaClient();
  const [dre, volumes, importados, digitados, metas] = await Promise.all([
    apurado
      ? prisma.resultadoApurado.findMany({
          where: { competenciaId, centroCustoId: null },
          select: { valor: true, linhaDRE: { select: { codigo: true } }, unidadeNegocio: { select: { codigo: true } } },
        })
      : [],
    apurado ? prisma.volumeOperacional.findMany({ where: { competenciaId }, select: { quantidade: true, regraRateio: { select: { origemDoVolume: true } } } }) : [],
    prisma.indicadorImportado.findMany({ where: { competenciaId }, select: { nome: true, valor: true } }),
    // Os digitados nas abas Comercial e Administrativo das Listas sobrepõem os importados.
    prisma.indicadorDigitado.findMany({ where: { competenciaId }, select: { nome: true, valor: true } }),
    // As metas do orçamento do mês (os GME 4 e 8).
    prisma.metaImportada.findMany({ where: { competenciaId }, select: { nome: true, valor: true } }),
  ]);
  const porMeta = new Map(metas.map((x) => [x.nome, Number(x.valor)]));
  const porVisao = new Map(dre.map((r) => [`${r.unidadeNegocio?.codigo ?? 0}|${r.linhaDRE.codigo}`, Number(r.valor)]));
  // Cada origem aparece em mais de uma regra de rateio com o mesmo volume: vale uma vez.
  const porOrigem = new Map(volumes.map((v) => [v.regraRateio.origemDoVolume, Number(v.quantidade)]));
  const porNome = new Map([...importados, ...digitados].map((i) => [i.nome, Number(i.valor)]));
  return {
    dre: (u, c) => (apurado ? (porVisao.get(`${u}|${c}`) ?? 0) : NaN),
    volume: (o) => (apurado ? (porOrigem.get(o) ?? 0) : NaN),
    importado: (n) => porNome.get(n) ?? null,
    meta: (n) => porMeta.get(n) ?? null,
  };
}

/** Liga cada mês aos anteriores do exercício (em ordem), para os indicadores acumulados do GME 8. */
export function encadearMeses<T extends DadosDoMes | null>(dados: T[]): T[] {
  dados.forEach((d, i) => {
    if (d) d.anteriores = dados.slice(0, i).filter((x): x is NonNullable<T> => x !== null);
  });
  return dados;
}

export const indicadoresService = {
  /** Os indicadores do exercício, mês a mês até `ate`, com o acumulado. */
  async listar(ano: number, ate?: number) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const competencias = new Map(
      (await getPrismaClient().competencia.findMany({ where: { ano, mes: { lte: ultimo } }, select: { id: true, mes: true } })).map((c) => [c.mes, c.id]),
    );
    // As metas importadas de cada mês (aba Metas (Orçamento)), para o orçado do gráfico do indicador, como no Painel de Bordo.
    const metasPorMes = new Map(
      (await getPrismaClient().metaImportada.findMany({ where: { competencia: { ano, mes: { lte: ultimo } } }, select: { nome: true, valor: true, competencia: { select: { mes: true } } } })).reduce(
        (m, x) => m.set(x.competencia.mes, (m.get(x.competencia.mes) ?? new Map<string, number>()).set(x.nome, Number(x.valor))),
        new Map<number, Map<string, number>>(),
      ),
    );
    const metas = meses.map((m) => metasPorMes.get(m.mes) ?? null);
    const dados = encadearMeses(
      await Promise.all(meses.map((m) => (competencias.has(m.mes) ? dadosDoMes(competencias.get(m.mes)!, m.competenciaId !== null) : null))),
    );
    return {
      ano,
      ate: ultimo,
      meses: meses.map(({ mes, rotulo, competenciaId }) => ({ mes, rotulo, apurado: competenciaId !== null })),
      indicadores: INDICADORES.map((i) => {
        const partes = dados.map((d) => (d ? i.calculo(d) : null));
        return {
          grupo: i.grupo,
          numero: i.numero,
          nome: i.nome,
          sentido: i.sentido,
          unidade: i.unidade,
          metodologia: i.metodologia,
          acumulado: i.acumulado,
          meses: partes.map((p) => p?.valor ?? null),
          total: acumular(i, partes),
          /** O orçado de cada mês (null sem as metas do mês, ou sem meta para o indicador) e o acumulado do orçado (só com as metas de todos os meses). */
          orcado: metas.map((m) => m?.get(i.nome) ?? null),
          totalOrcado: metas.every((m) => m !== null) ? acumularMeta(i.nome, metas) : null,
        };
      }),
    };
  },
};
