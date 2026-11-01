import { getPrismaClient } from "../../config/prisma.js";
import { calcularCenario, cenarioDaComparacao, metasPorMes, type Comparacao } from "../cenarios/indicadoresDoCenario.js";
import type { MarcacaoCenario } from "../../generated/prisma/enums.js";
import type { Indicador } from "./indicadores.js";

/**
 * O orçado de Resultados Empresariais (Indicadores e Painel de Bordo): as Metas Orçadas do cenário marcado como
 * Orçamento Empresarial no exercício (Criação de Cenários / Cenários Sintéticos), calculadas como as de Resultados
 * Realizados. Desde 11/10/2026, as metas importadas (aba Metas (Orçamento), no Fechamento Mensal) não valem mais
 * fora dos cenários: sem cenário marcado no exercício, ou sem o valor no cenário, o orçado é zero.
 */
export type Orcamento = {
  /** O cenário de onde vem o orçado; null: nenhum cenário marcado no exercício (o orçado é zero). */
  cenario: { id: string; nome: string; marcacao: MarcacaoCenario | null } | null;
  /** O orçado de cada mês, JAN a DEZ, de todos os indicadores (zero sem valor). */
  porMes: Array<Map<string, number>>;
  /** Os meses em que o cenário não tem nenhum valor (só com cenário). */
  mesesSemValor: number[];
  /** O acumulado do orçado de janeiro até `ate` (zero sem valor). */
  acumulado: (i: Pick<Indicador, "nome" | "acumulado">, ate: number) => number;
};

/**
 * Os cenários dos cards PROVA (31/10/2026, os Relatórios Executivos): o orçado de cada um, com a marcação. Pode vir numa
 * promessa, buscada junto com o realizado (o painel e os indicadores a esperam só no fim).
 */
export type CenariosDoProva = Array<readonly [MarcacaoCenario, Orcamento]> | Promise<Array<readonly [MarcacaoCenario, Orcamento]>>;

/**
 * O orçado de cada marcação da Comparação PROVA (31/10/2026: a de Resultados Empresariais), só das que têm cenário, numa
 * promessa que o painel e os indicadores esperam no fim. Ela já sai com o tratamento do erro (o erro chega a quem a
 * espera), para não ser uma rejeição sem tratamento enquanto o realizado se busca.
 */
export function orcamentosDoProva(marcacoes: MarcacaoCenario[]): CenariosDoProva {
  const p = Promise.all(marcacoes.map(async (m) => [m, await orcamentoDoExercicio(m)] as const)).then((l) => l.filter(([, o]) => o.cenario));
  p.catch(() => undefined);
  return p;
}

/** `comparacao` (21/10/2026): o cenário do Compara Com (22/10/2026: ou um cenário escolhido); sem ela, o Orçamento Empresarial. */
export async function orcamentoDoExercicio(comparacao: Comparacao = "ORCAMENTO_EMPRESARIAL"): Promise<Orcamento> {
  const nomes = (await getPrismaClient().indicadorEstrutura.findMany({ where: { ativo: true }, select: { nome: true } })).map((i) => i.nome);
  const cenario = await cenarioDaComparacao(comparacao);
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
