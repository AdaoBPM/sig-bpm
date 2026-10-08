import { getPrismaClient } from "../../config/prisma.js";
import { acumular, INDICADORES, valorDaParte, type DadosDoMes, type Parte } from "./indicadores.js";
import { mesesDoExercicio } from "./resultadosService.js";

/** Os dados de cada mês apurado: a DRE de todas as visões e os volumes congelados dos rateios. */
async function dadosDoMes(competenciaId: string): Promise<DadosDoMes> {
  const prisma = getPrismaClient();
  const [dre, volumes] = await Promise.all([
    prisma.resultadoApurado.findMany({
      where: { competenciaId, centroCustoId: null },
      select: { valor: true, linhaDRE: { select: { codigo: true } }, unidadeNegocio: { select: { codigo: true } } },
    }),
    prisma.volumeOperacional.findMany({ where: { competenciaId }, select: { quantidade: true, regraRateio: { select: { origemDoVolume: true } } } }),
  ]);
  const porVisao = new Map(dre.map((r) => [`${r.unidadeNegocio?.codigo ?? 0}|${r.linhaDRE.codigo}`, Number(r.valor)]));
  // Cada origem aparece em mais de uma regra de rateio com o mesmo volume: vale uma vez.
  const porOrigem = new Map(volumes.map((v) => [v.regraRateio.origemDoVolume, Number(v.quantidade)]));
  return { dre: (u, c) => porVisao.get(`${u}|${c}`) ?? 0, volume: (o) => porOrigem.get(o) ?? 0 };
}

export const indicadoresService = {
  /** Os indicadores do exercício, mês a mês até `ate`, com o acumulado. */
  async listar(ano: number, ate?: number) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const dados = await Promise.all(meses.map((m) => (m.competenciaId ? dadosDoMes(m.competenciaId) : null)));
    return {
      ano,
      ate: ultimo,
      meses: meses.map(({ mes, rotulo, competenciaId }) => ({ mes, rotulo, apurado: competenciaId !== null })),
      indicadores: INDICADORES.map((i) => {
        const partes = dados.map((d) => (d && i.calculo ? i.calculo(d) : null));
        return {
          grupo: i.grupo,
          numero: i.numero,
          nome: i.nome,
          sentido: i.sentido,
          unidade: i.unidade,
          metodologia: i.metodologia,
          acumulado: i.acumulado,
          comFonte: !!i.calculo,
          meses: partes.map((p) => (p ? valorDaParte(p) : null)),
          total: i.calculo ? acumular(i, partes.filter((p): p is Parte => p !== null)) : null,
        };
      }),
    };
  },
};
