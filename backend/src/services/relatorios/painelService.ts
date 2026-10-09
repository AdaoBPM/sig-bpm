import { getPrismaClient } from "../../config/prisma.js";
import { acumular, INDICADORES, type Parte } from "./indicadores.js";
import { dadosDoMes } from "./indicadoresService.js";
import { acumularMeta } from "./metasOrcamento.js";
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
type MesDaSerie = { rotulo: string; realizado: Valor; orcado: Valor };

function montar(quadros: QuadroPainel[], periodos: { mes: [Valor, Valor]; acumulado: [Valor, Valor] }, serie: MesDaSerie[]) {
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
   * orçado, das metas importadas (aba Metas (Orçamento)). O acumulado vai de
   * janeiro ao mês; sem as metas de algum desses meses, o orçado acumulado
   * fica sem valor (e os meses vão em `mesesSemMeta`).
   */
  async painel(ano: number, ate?: number) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const competencias = await getPrismaClient().competencia.findMany({
      where: { ano, mes: { lte: ultimo } },
      select: { id: true, mes: true, metasImportadas: { select: { nome: true, valor: true } } },
    });
    const porMes = new Map(competencias.map((c) => [c.mes, c]));
    const dados = await Promise.all(
      meses.map((m) => (porMes.has(m.mes) ? dadosDoMes(porMes.get(m.mes)!.id, m.competenciaId !== null) : null)),
    );
    const metas = meses.map((m) => {
      const lista = porMes.get(m.mes)?.metasImportadas ?? [];
      return lista.length ? new Map(lista.map((x) => [x.nome, Number(x.valor)])) : null;
    });

    // Os indicadores realizados: as partes de cada mês, para o valor do mês de referência e o acumulado.
    const partes = new Map(INDICADORES.map((i) => [i.nome, dados.map((d): Parte | null => (d ? i.calculo(d) : null))]));
    const porNome = new Map(INDICADORES.map((i) => [i.nome, i]));
    const realizadoMes: Valor = (n) => partes.get(n)?.[ultimo - 1]?.valor ?? null;
    const realizadoAcum: Valor = (n) => (porNome.has(n) ? acumular(porNome.get(n)!, partes.get(n)!) : null);
    const orcadoMes: Valor = (n) => metas[ultimo - 1]?.get(n) ?? null;
    const completas = metas.every((m) => m !== null);
    const orcadoAcum: Valor = (n) => (completas ? acumularMeta(n, metas) : null);

    const periodos = { mes: [realizadoMes, orcadoMes] as [Valor, Valor], acumulado: [realizadoAcum, orcadoAcum] as [Valor, Valor] };
    // A série mês a mês (gráficos do painel, como os da planilha): o realizado e o orçado de cada mês até o de referência.
    const serie: MesDaSerie[] = meses.map((m, i) => ({
      rotulo: MESES[m.mes - 1],
      realizado: (n) => partes.get(n)?.[i]?.valor ?? null,
      orcado: (n) => metas[i]?.get(n) ?? null,
    }));
    return {
      ano,
      ate: ultimo,
      rotuloMes: `${MESES[ultimo - 1]}/${ano}`,
      rotuloAcumulado: `ACUMULADO/${ano}`,
      mesApurado: meses[ultimo - 1].competenciaId !== null,
      mesesSemMeta: meses.filter((_, i) => metas[i] === null).map((m) => `${MESES[m.mes - 1]}/${ano}`),
      abas: [
        { chave: "resultados", titulo: "Resultados", quadros: montar(PAINEL_RESULTADOS, periodos, serie) },
        { chave: "performance", titulo: "Performance", quadros: montar(PAINEL_PERFORMANCE, periodos, serie) },
      ],
    };
  },
};
