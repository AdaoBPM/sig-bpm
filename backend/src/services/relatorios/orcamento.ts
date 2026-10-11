import { getPrismaClient } from "../../config/prisma.js";
import { calcularCenario, cenarioMarcado, metasPorMes } from "../cenarios/indicadoresDoCenario.js";
import type { Indicador } from "./indicadores.js";

/**
 * O orçado de Resultados Realizados (Indicadores e Painel de Bordo): as Metas Orçadas do cenário marcado como
 * Orçamento Empresarial no exercício (Criação de Cenários / Cenários Sintéticos), calculadas como as de Resultados
 * Realizados. Desde 11/10/2026, as metas importadas (aba Metas (Orçamento), no Fechamento Mensal) não valem mais
 * fora dos cenários: sem cenário marcado no exercício, ou sem o valor no cenário, o orçado é zero.
 */
export type Orcamento = {
  /** O cenário de onde vem o orçado; null: nenhum cenário marcado no exercício (o orçado é zero). */
  cenario: { id: string; nome: string } | null;
  /** O orçado de cada mês, JAN a DEZ, de todos os indicadores (zero sem valor). */
  porMes: Array<Map<string, number>>;
  /** Os meses em que o cenário não tem nenhum valor (só com cenário). */
  mesesSemValor: number[];
  /** O acumulado do orçado de janeiro até `ate` (zero sem valor). */
  acumulado: (i: Pick<Indicador, "nome" | "acumulado">, ate: number) => number;
};

export async function orcamentoDoExercicio(ano: number): Promise<Orcamento> {
  const nomes = (await getPrismaClient().indicadorEstrutura.findMany({ where: { ativo: true }, select: { nome: true } })).map((i) => i.nome);
  const cenario = await cenarioMarcado(ano, "ORCAMENTO_EMPRESARIAL");
  if (!cenario) {
    const zeros = Array.from({ length: 12 }, () => new Map(nomes.map((n) => [n, 0])));
    return { cenario: null, porMes: zeros, mesesSemValor: [], acumulado: () => 0 };
  }
  const calculo = await calcularCenario(cenario.id);
  const porNome = new Map(calculo.indicadores.map((i) => [i.indicador.nome, i]));
  const doCenario = metasPorMes(calculo);
  return {
    cenario,
    porMes: doCenario.map((m) => new Map(nomes.map((n) => [n, m?.get(n) ?? 0]))),
    mesesSemValor: doCenario.flatMap((m, k) => (m ? [] : [k + 1])),
    acumulado: (i, ate) => {
      const x = porNome.get(i.nome);
      return (x ? calculo.acumulado(x, ate) : null) ?? 0;
    },
  };
}
