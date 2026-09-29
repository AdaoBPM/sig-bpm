import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { totaisDaCompetencia } from "../volumes/volumesService.js";
import { apurarUnidades, type LinhaEstrutura } from "./apuracaoUnidades.js";

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

export const dreService = {
  /**
   * Apura a DRE das cinco unidades a partir do que já está apurado no mês — a
   * classificação dos lançamentos, os rateios e a receita prévia — e dos
   * lançamentos manuais. Grava o resultado por unidade e linha, com a
   * composição de cada valor, substituindo a apuração anterior.
   */
  async apurarUnidades(ano: number, mes: number, usuarioId?: string) {
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
        select: { filial: true, linhaDREId: true, balde: true, alocacao: true, valorMovimento: true },
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

    const unidades = new Map((await prisma.unidadeNegocio.findMany({ select: { id: true, codigo: true } })).map((u) => [u.codigo, u.id]));
    const agora = new Date();
    await prisma.$transaction(
      async (tx) => {
        await tx.resultadoApurado.deleteMany({ where: { competenciaId: c.id, centroCustoId: null, unidadeNegocioId: { not: null } } });
        for (let i = 0; i < resultados.length; i += 500) {
          await tx.resultadoApurado.createMany({
            data: resultados.slice(i, i + 500).map((r) => ({
              competenciaId: c.id,
              unidadeNegocioId: unidades.get(r.unidade)!,
              linhaDREId: r.linhaId,
              valor: r.valor,
              composicao: (r.composicao ?? Prisma.DbNull) as Prisma.InputJsonValue,
              apuradoEm: agora,
              apuradoPor: usuarioId ?? null,
            })),
          });
        }
      },
      { timeout: 120_000 },
    );
    return { resultados: resultados.length, avisos };
  },

  /** A DRE apurada de uma unidade, na ordem da estrutura. */
  async consultarUnidade(ano: number, mes: number, unidade: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    const prisma = getPrismaClient();
    const [linhas, valores] = await Promise.all([
      estrutura(),
      prisma.resultadoApurado.findMany({
        where: { competenciaId: c.id, centroCustoId: null, unidadeNegocio: { codigo: unidade } },
        select: { linhaDREId: true, valor: true, composicao: true, apuradoEm: true, congelado: true },
      }),
    ]);
    const porLinha = new Map(valores.map((v) => [v.linhaDREId, v]));
    return {
      competencia: { ano, mes, status: c.status },
      unidade,
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
  },
};
