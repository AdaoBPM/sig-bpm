import { getPrismaClient } from "../../config/prisma.js";
import { calcularPercentuais } from "./percentuaisRateio.js";
import type { CodigoTotais } from "./totaisOperacao.js";
import { totaisDaCompetencia } from "./volumesService.js";

/** Erro de regra — vira 400/404/409 no controller, não 500. */
export class RegraRateioError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

async function competenciaPorAnoMes(ano: number, mes: number) {
  const c = await getPrismaClient().competencia.findUnique({
    where: { ano_mes: { ano, mes } },
    select: { id: true, ano: true, mes: true, status: true },
  });
  if (!c) throw new RegraRateioError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  return c;
}

/** Regras vigentes no mês: início até o dia 1º, e sem fim ou fim depois dele. */
async function regrasVigentes(ano: number, mes: number) {
  const inicioMes = new Date(Date.UTC(ano, mes - 1, 1));
  return getPrismaClient().regraRateio.findMany({
    where: { vigenciaInicio: { lte: inicioMes }, OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: inicioMes } }] },
    orderBy: [{ ordem: "asc" }],
    select: { id: true, chave: true, destino: true, origemDoVolume: true, baseFisica: true, rotulo: true, unidadeDestinoId: true },
  });
}

export const rateiosService = {
  /**
   * Apura os volumes e os percentuais da competência a partir das listas
   * gravadas e grava o retrato, substituindo a apuração anterior. O retrato
   * congelado (Passo 21) não é refeito.
   */
  async apurar(ano: number, mes: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    if (c.status === "FECHADA") throw new RegraRateioError(409, `A competência ${rotulo(ano, mes)} está fechada. Reapurar exige reabri-la.`);
    const prisma = getPrismaClient();
    if (await prisma.volumeOperacional.count({ where: { competenciaId: c.id, congelado: true } })) {
      throw new RegraRateioError(409, `Os rateios de ${rotulo(ano, mes)} estão congelados pela apuração da competência. Para recalcular, reapure a competência (tela da DRE).`);
    }
    const [regras, totais] = await Promise.all([regrasVigentes(ano, mes), totaisDaCompetencia(c.id)]);
    if (regras.length === 0) throw new RegraRateioError(409, "Não há regras de rateio vigentes. Carregue o cadastro.");
    const porCodigo = new Map(totais.map((t) => [t.codigo as string, t.quantidade]));
    const calculados = calcularPercentuais(
      regras.map((r) => ({ id: r.id, chave: r.chave, destino: r.destino, origem: r.origemDoVolume as CodigoTotais })),
      porCodigo,
    );
    const unidadePorRegra = new Map(regras.map((r) => [r.id, r.unidadeDestinoId]));
    const agora = new Date();
    await prisma.$transaction([
      prisma.volumeOperacional.deleteMany({ where: { competenciaId: c.id } }),
      prisma.volumeOperacional.createMany({
        data: calculados.map((p) => ({
          competenciaId: c.id,
          regraRateioId: p.id,
          unidadeNegocioId: unidadePorRegra.get(p.id)!,
          quantidade: p.quantidade,
          percentual: p.percentual,
          apuradoEm: agora,
        })),
      }),
    ]);
    return this.consultar(ano, mes);
  },

  /**
   * Os percentuais apurados, por chave, com a memória de cálculo: o volume de
   * cada destino, a linha dos Totais de onde veio e o total da chave. Traz
   * também os Totais de hoje, para mostrar se as listas mudaram depois da
   * apuração.
   */
  async consultar(ano: number, mes: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    const prisma = getPrismaClient();
    const [volumes, totais] = await Promise.all([
      prisma.volumeOperacional.findMany({
        where: { competenciaId: c.id },
        select: {
          quantidade: true,
          percentual: true,
          apuradoEm: true,
          congelado: true,
          regraRateio: { select: { chave: true, destino: true, origemDoVolume: true, baseFisica: true, rotulo: true, ordem: true } },
        },
        orderBy: { regraRateio: { ordem: "asc" } },
      }),
      totaisDaCompetencia(c.id),
    ]);
    const totalAtual = new Map(totais.map((t) => [t.codigo as string, t.quantidade]));
    const chaves = new Map<string, { chave: string; baseFisica: string; total: number; destinos: unknown[] }>();
    for (const v of volumes) {
      const r = v.regraRateio;
      const k = chaves.get(r.chave) ?? { chave: r.chave, baseFisica: r.baseFisica, total: 0, destinos: [] };
      k.total += Number(v.quantidade);
      const atual = totalAtual.get(r.origemDoVolume);
      k.destinos.push({
        destino: r.destino,
        rotulo: r.rotulo,
        origem: r.origemDoVolume,
        quantidade: v.quantidade.toFixed(3),
        percentual: v.percentual.toFixed(10),
        /**
         * Volume de hoje, se as listas mudaram depois da apuração. Compara com
         * as três casas das listas: as somas guardam resíduo de ponto flutuante
         * (6806.303000000003), que não é mudança.
         */
        quantidadeAtual: atual && atual.toFixed(3) !== v.quantidade.toFixed(3) ? atual.toFixed(3) : null,
      });
      chaves.set(r.chave, k);
    }
    return {
      competencia: { ano, mes, status: c.status },
      apuradoEm: volumes[0]?.apuradoEm ?? null,
      congelado: volumes.some((v) => v.congelado),
      chaves: [...chaves.values()].map((k) => ({ ...k, total: k.total.toFixed(3) })),
      totais: totais.map((t) => ({ codigo: t.codigo, rotulo: t.rotulo, medida: t.medida, tipo: t.tipo, quantidade: t.quantidade.toFixed(3) })),
    };
  },
};
