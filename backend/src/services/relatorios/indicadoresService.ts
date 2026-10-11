import { getPrismaClient } from "../../config/prisma.js";
import { acumular, type DadosDoMes } from "./indicadores.js";
import { catalogoDeIndicadores, TOTAIS_SINTETICOS } from "./catalogoIndicadores.js";
import { totaisDaCompetencia } from "../volumes/volumesService.js";
import { orcamentoDoExercicio } from "./orcamento.js";
import { mesesDoExercicio } from "./resultadosService.js";

/**
 * Os dados de um mês: a DRE de todas as visões e os volumes congelados dos
 * rateios (só no mês apurado; senão NaN, e o indicador fica sem valor) e os
 * indicadores importados (com ou sem apuração). `metasDoOrcamento`: o orçado do mês (o do cenário Orçamento
 * Empresarial, que os GME 4 e 8 e o item [META] das fórmulas usam); sem ele, sem metas. As metas importadas (aba Metas
 * (Orçamento)) não valem mais fora dos cenários (11/10/2026).
 */
export async function dadosDoMes(competenciaId: string, apurado: boolean, metasDoOrcamento?: Map<string, number> | null): Promise<DadosDoMes> {
  const prisma = getPrismaClient();
  const [dre, volumes, importados, digitados, totaisListas] = await Promise.all([
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
    // Os totais das listas do mês (os totalizadores que não têm volume congelado: Expedição, Montagem, Pistas…).
    apurado ? totaisDaCompetencia(competenciaId) : [],
  ]);
  const porLista = new Map(totaisListas.map((t) => [t.codigo as string, Number(t.quantidade)]));
  const totalDaLista = (c: string): number => (porOrigem.has(c) ? porOrigem.get(c)! : (porLista.get(c) ?? 0));
  const porMeta = metasDoOrcamento ?? new Map<string, number>();
  const porVisao = new Map(dre.map((r) => [`${r.unidadeNegocio?.codigo ?? 0}|${r.linhaDRE.codigo}`, Number(r.valor)]));
  // Cada origem aparece em mais de uma regra de rateio com o mesmo volume: vale uma vez.
  const porOrigem = new Map(volumes.map((v) => [v.regraRateio.origemDoVolume, Number(v.quantidade)]));
  const porNome = new Map([...importados, ...digitados].map((i) => [i.nome, Number(i.valor)]));
  return {
    dre: (u, c) => (apurado ? (porVisao.get(`${u}|${c}`) ?? 0) : NaN),
    volume: (o) => (apurado ? (porOrigem.get(o) ?? 0) : NaN),
    importado: (n) => porNome.get(n) ?? null,
    meta: (n) => porMeta.get(n) ?? null,
    lista: (c) => {
      if (!apurado) return NaN;
      const sintetico = TOTAIS_SINTETICOS[c];
      return sintetico ? sintetico.codigos.reduce((s, x) => s + totalDaLista(x), 0) : totalDaLista(c);
    },
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
    // O orçado de cada mês, para o gráfico do indicador, como no Painel de Bordo: o cenário Orçamento Empresarial (sem ele, zero).
    const orcamento = await orcamentoDoExercicio(ano);
    const metas = meses.map((m) => orcamento.porMes[m.mes - 1]);
    // Os indicadores do cadastro Estrutura dos Indicadores, com as fórmulas.
    const catalogo = await catalogoDeIndicadores();
    const dados = encadearMeses(
      await Promise.all(meses.map((m) => (competencias.has(m.mes) ? dadosDoMes(competencias.get(m.mes)!, m.competenciaId !== null, orcamento.porMes[m.mes - 1]) : null))),
    );
    return {
      ano,
      ate: ultimo,
      /** O cenário do orçado (null: nenhum cenário Orçamento Empresarial no exercício; o orçado é zero). */
      cenarioOrcado: orcamento.cenario?.nome ?? null,
      meses: meses.map(({ mes, rotulo, competenciaId }) => ({ mes, rotulo, apurado: competenciaId !== null })),
      indicadores: catalogo.map((i) => {
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
          /** O orçado de cada mês e o acumulado do orçado (zero sem o cenário Orçamento Empresarial ou sem o valor nele). */
          orcado: metas.map((m) => m.get(i.nome) ?? 0),
          totalOrcado: orcamento.acumulado(i, ultimo),
        };
      }),
    };
  },
};
