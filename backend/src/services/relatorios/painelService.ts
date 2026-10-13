import { getPrismaClient } from "../../config/prisma.js";
import { acumular, type Parte } from "./indicadores.js";
import { catalogoDeIndicadores } from "./catalogoIndicadores.js";
import { dadosDoMes, encadearMeses } from "./indicadoresService.js";
import { orcamentoDoExercicio } from "./orcamento.js";
import { PAINEL_PERFORMANCE, PAINEL_RESULTADOS, sinal, vsOrcado, type ItemPainel, type QuadroPainel, type Valor } from "./painelDeBordo.js";
import { mesesDoExercicio } from "./resultadosService.js";

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** O item num período (o mês ou o acumulado): realizado, orçado, o percentual sob o realizado, o desvio e o sinal. */
function bloco(item: ItemPainel, realizado: Valor, orcado: Valor) {
  const r = item.conta(realizado);
  const o = item.conta(orcado);
  return { realizado: r, orcado: o, base: item.base?.conta(realizado) ?? null, vsOrcado: vsOrcado(r, o), sinal: sinal(item, r, o) };
}

/** Os meses do exercício até o de referência, para os gráficos: o realizado e o orçado de cada um. */
export type MesDaSerie = { rotulo: string; realizado: Valor; orcado: Valor };

/** Os quadros do painel; exportada para o Painel de Bordo dos cenários (13/10/2026: o cenário × o comparado). */
export function montarPainel(quadros: QuadroPainel[], periodos: { mes: [Valor, Valor]; acumulado: [Valor, Valor] }, serie: MesDaSerie[]) {
  return quadros.map((q) => ({
    titulo: q.titulo,
    itens: q.itens.map((i) => ({
      titulo: i.titulo,
      sigla: i.sigla,
      sentido: i.sentido,
      formato: i.formato,
      formatoAcumulado: i.formatoAcumulado ?? i.formato,
      base: i.base ? { rotulo: i.base.rotulo, casas: i.base.casas } : null,
      separar: i.separar ?? false,
      mes: bloco(i, ...periodos.mes),
      acumulado: bloco(i, ...periodos.acumulado),
      serie: serie.map((m) => ({ mes: m.rotulo, realizado: i.conta(m.realizado), orcado: i.conta(m.orcado) })),
    })),
  }));
}

export const painelService = {
  /**
   * O Painel de Bordo do mês `ate` (sem ele, o último apurado): o realizado
   * sai dos indicadores (DRE apurada, volumes e indicadores importados); o
   * orçado, do cenário marcado como Orçamento Empresarial no exercício; sem
   * ele, ou sem o valor nele, zero (as metas importadas não valem mais, desde
   * 11/10/2026). O acumulado vai de janeiro ao mês; os meses que o cenário não
   * tem vão em `mesesSemMeta`.
   */
  async painel(ano: number, ate?: number, somenteFechadas = false) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate, somenteFechadas);
    // Com `somenteFechadas` (Resultados Realizados), só os meses de competência fechada têm valor.
    const fechados = new Set(meses.filter((m) => m.competenciaId !== null).map((m) => m.mes));
    const competencias = (await getPrismaClient().competencia.findMany({ where: { ano, mes: { lte: ultimo } }, select: { id: true, mes: true } })).filter(
      (c) => !somenteFechadas || fechados.has(c.mes),
    );
    const porMes = new Map(competencias.map((c) => [c.mes, c]));
    const orcamento = await orcamentoDoExercicio(ano);
    const dados = encadearMeses(
      await Promise.all(
        meses.map((m) => (porMes.has(m.mes) ? dadosDoMes(porMes.get(m.mes)!.id, m.competenciaId !== null, orcamento.porMes[m.mes - 1]) : null)),
      ),
    );
    const metas = meses.map((m) => orcamento.porMes[m.mes - 1]);

    // Os indicadores realizados: as partes de cada mês, para o valor do mês de referência e o acumulado.
    const catalogo = await catalogoDeIndicadores();
    const partes = new Map(catalogo.map((i) => [i.nome, dados.map((d): Parte | null => (d ? i.calculo(d) : null))]));
    const porNome = new Map(catalogo.map((i) => [i.nome, i]));
    const realizadoMes: Valor = (n) => partes.get(n)?.[ultimo - 1]?.valor ?? null;
    const realizadoAcum: Valor = (n) => (porNome.has(n) ? acumular(porNome.get(n)!, partes.get(n)!) : null);
    const orcadoMes: Valor = (n) => metas[ultimo - 1].get(n) ?? 0;
    const orcadoAcum: Valor = (n) => (porNome.has(n) ? orcamento.acumulado(porNome.get(n)!, ultimo) : 0);

    const periodos = { mes: [realizadoMes, orcadoMes] as [Valor, Valor], acumulado: [realizadoAcum, orcadoAcum] as [Valor, Valor] };
    // A série mês a mês (gráficos do painel, como os da planilha): o realizado e o orçado de cada mês até o de referência.
    const serie: MesDaSerie[] = meses.map((m, i) => ({
      rotulo: MESES[m.mes - 1],
      realizado: (n) => partes.get(n)?.[i]?.valor ?? null,
      orcado: (n) => metas[i].get(n) ?? 0,
    }));
    return {
      ano,
      ate: ultimo,
      rotuloMes: `${MESES[ultimo - 1]}/${ano}`,
      rotuloAcumulado: `ACUMULADO/${ano}`,
      mesApurado: meses[ultimo - 1].competenciaId !== null,
      /** O cenário do orçado (null: nenhum cenário Orçamento Empresarial no exercício; o orçado é zero). */
      cenarioOrcado: orcamento.cenario?.nome ?? null,
      mesesSemMeta: meses.filter((m) => orcamento.mesesSemValor.includes(m.mes)).map((m) => `${MESES[m.mes - 1]}/${ano}`),
      abas: [
        { chave: "resultados", titulo: "Resultados", quadros: montarPainel(PAINEL_RESULTADOS, periodos, serie) },
        { chave: "performance", titulo: "Performance", quadros: montarPainel(PAINEL_PERFORMANCE, periodos, serie) },
      ],
    };
  },
};
