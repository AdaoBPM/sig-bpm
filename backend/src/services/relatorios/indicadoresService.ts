import { getPrismaClient } from "../../config/prisma.js";
import { acumular, INDICADORES, type DadosDoMes } from "./indicadores.js";
import { mesesDoExercicio } from "./resultadosService.js";

/**
 * Os dados de um mês: a DRE de todas as visões e os volumes congelados dos
 * rateios (só no mês apurado; senão NaN, e o indicador fica sem valor) e os
 * indicadores importados (com ou sem apuração).
 */
export async function dadosDoMes(competenciaId: string, apurado: boolean): Promise<DadosDoMes> {
  const prisma = getPrismaClient();
  const [dre, volumes, importados] = await Promise.all([
    apurado
      ? prisma.resultadoApurado.findMany({
          where: { competenciaId, centroCustoId: null },
          select: { valor: true, linhaDRE: { select: { codigo: true } }, unidadeNegocio: { select: { codigo: true } } },
        })
      : [],
    apurado ? prisma.volumeOperacional.findMany({ where: { competenciaId }, select: { quantidade: true, regraRateio: { select: { origemDoVolume: true } } } }) : [],
    prisma.indicadorImportado.findMany({ where: { competenciaId }, select: { nome: true, valor: true } }),
  ]);
  const porVisao = new Map(dre.map((r) => [`${r.unidadeNegocio?.codigo ?? 0}|${r.linhaDRE.codigo}`, Number(r.valor)]));
  // Cada origem aparece em mais de uma regra de rateio com o mesmo volume: vale uma vez.
  const porOrigem = new Map(volumes.map((v) => [v.regraRateio.origemDoVolume, Number(v.quantidade)]));
  const porNome = new Map(importados.map((i) => [i.nome, Number(i.valor)]));
  return {
    dre: (u, c) => (apurado ? (porVisao.get(`${u}|${c}`) ?? 0) : NaN),
    volume: (o) => (apurado ? (porOrigem.get(o) ?? 0) : NaN),
    importado: (n) => porNome.get(n) ?? null,
  };
}

export const indicadoresService = {
  /** Os indicadores do exercício, mês a mês até `ate`, com o acumulado. */
  async listar(ano: number, ate?: number) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const competencias = new Map(
      (await getPrismaClient().competencia.findMany({ where: { ano, mes: { lte: ultimo } }, select: { id: true, mes: true } })).map((c) => [c.mes, c.id]),
    );
    const dados = await Promise.all(
      meses.map((m) => (competencias.has(m.mes) ? dadosDoMes(competencias.get(m.mes)!, m.competenciaId !== null) : null)),
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
        };
      }),
    };
  },
};
