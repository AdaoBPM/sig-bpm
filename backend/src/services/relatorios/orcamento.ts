import { getPrismaClient } from "../../config/prisma.js";
import { calcularCenario, cenarioMarcado, metasPorMes } from "../cenarios/indicadoresDoCenario.js";
import type { Indicador } from "./indicadores.js";
import { acumularMeta } from "./metasOrcamento.js";

/**
 * O orçado de Resultados Realizados (Indicadores e Painel de Bordo): desde 11/10/2026, as metas orçadas do cenário
 * marcado como Orçamento Empresarial no exercício (Criação de Cenários / Cenários Sintéticos), calculadas como as de
 * Resultados Realizados; sem cenário marcado, as metas importadas da aba Metas (Orçamento), como antes.
 */
export type Orcamento = {
  /** O cenário de onde vem o orçado; null: as metas importadas. */
  cenario: { id: string; nome: string } | null;
  /** O orçado de cada mês, JAN a DEZ (null sem nenhum valor no mês). */
  porMes: Array<Map<string, number> | null>;
  /** O acumulado do orçado de janeiro até `ate`. */
  acumulado: (i: Pick<Indicador, "nome" | "acumulado">, ate: number) => number | null;
};

export async function orcamentoDoExercicio(ano: number): Promise<Orcamento> {
  const cenario = await cenarioMarcado(ano, "ORCAMENTO_EMPRESARIAL");
  if (cenario) {
    const calculo = await calcularCenario(cenario.id);
    const porNome = new Map(calculo.indicadores.map((i) => [i.indicador.nome, i]));
    return {
      cenario,
      porMes: metasPorMes(calculo),
      acumulado: (i, ate) => {
        const x = porNome.get(i.nome);
        return x ? calculo.acumulado(x, ate) : null;
      },
    };
  }
  const metas = await getPrismaClient().metaImportada.findMany({ where: { competencia: { ano } }, select: { nome: true, valor: true, competencia: { select: { mes: true } } } });
  const porMes = Array.from({ length: 12 }, (_, k) => {
    const doMes = metas.filter((m) => m.competencia.mes === k + 1);
    return doMes.length ? new Map(doMes.map((m) => [m.nome, Number(m.valor)])) : null;
  });
  return {
    cenario: null,
    porMes,
    // Só com as metas de todos os meses até `ate`, como antes.
    acumulado: (i, ate) => {
      const meses = porMes.slice(0, ate);
      return meses.every((m) => m !== null) ? acumularMeta(i, meses) : null;
    },
  };
}
