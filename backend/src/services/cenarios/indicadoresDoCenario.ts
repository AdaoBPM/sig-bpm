import { getPrismaClient } from "../../config/prisma.js";
import type { MarcacaoCenario } from "../../generated/prisma/enums.js";
import { INDICADORES_DAS_LISTAS, montarIndicador } from "../relatorios/catalogoIndicadores.js";
import { compilarFormula } from "../relatorios/formulaIndicador.js";
import { acumular, type DadosDoMes, type Indicador, type Parte } from "../relatorios/indicadores.js";
import { acumularMeta } from "../relatorios/metasOrcamento.js";
import { gruposDoCadastro } from "./centrosCenario.js";
import { QUADROS_DE_LOTACAO, quadrosDeLotacao, VENDA_LOTACAO } from "./lotacaoCenario.js";

/**
 * Os indicadores de um cenário sintético (11/10/2026), com as fórmulas do cadastro Estrutura dos Indicadores — as
 * mesmas de Resultados Realizados —, sobre a DRE do cenário e os lançamentos manuais dele. Cada indicador fica numa
 * classe:
 *
 * - RESULTADO: a fórmula só usa linhas da DRE (custos, volumes, receitas, margens…): sai da DRE do cenário;
 * - MANUAL: os que não saem da DRE — os quadros de lotação e os numerados do Comercial e do Administrativo (os das
 *   abas Comercial e Administrativo das Listas): vêm da aba das metas e se digitam na tela;
 * - CALCULADO: a fórmula junta a DRE e os lançamentos manuais (as eficiências: volume ou receita por colaborador);
 * - IMPORTADO: os que o cenário não tem como calcular (a liberação de projetos, que vem das Listas, e os GME 4 e 8,
 *   que usam a demanda condicionada à venda e o orçado acumulado): ficam com o valor da aba das metas.
 *
 * O acumulado é o de Resultados Realizados (acumular); nos importados, o das metas (acumularMeta).
 *
 * No cenário analítico (14/10/2026), os quadros de lotação são CALCULADOS: saem do Quadro de Lotação dos grupos de
 * centros de custo (lotacaoCenario.ts), e não são lançamentos manuais.
 */

export type ClasseIndicador = "RESULTADO" | "MANUAL" | "CALCULADO" | "IMPORTADO";

const MANUAIS = new Set(INDICADORES_DAS_LISTAS);

type Linha = { nome: string; formula: string | null; peso: string | null; modo: string };

export function classificar(r: Linha, analitico = false): ClasseIndicador {
  if (analitico && QUADROS_DE_LOTACAO.has(r.nome)) return "CALCULADO";
  if (MANUAIS.has(r.nome)) return "MANUAL";
  // Do sistema, só a eficiência da operação total se calcula (a DRE e os quadros); os GME, não.
  if (r.modo === "SISTEMA" || !r.formula) return r.nome.startsWith("Eficiência") ? "CALCULADO" : "IMPORTADO";
  const itens = [...compilarFormula(r.formula).itens.values(), ...(r.modo === "MEDIA_PONDERADA" && r.peso ? compilarFormula(r.peso).itens.values() : [])];
  const tipos = new Set(itens.map((i) => i.tipo));
  if (tipos.has("LISTA") || tipos.has("META")) return "IMPORTADO";
  if (tipos.has("IND")) return "CALCULADO";
  return "RESULTADO";
}

export type IndicadorDoCenario = {
  indicador: Indicador;
  classe: ClasseIndicador;
  /** As partes de cada mês (JAN a DEZ), para o valor e o acumulado. */
  partes: Array<Parte | null>;
  /** Os meses digitados (só nos manuais). */
  digitados: boolean[];
};

export type CalculoDoCenario = {
  ano: number;
  /** Os meses com a DRE do cenário. */
  mesesComDRE: boolean[];
  indicadores: IndicadorDoCenario[];
  /** As metas importadas de cada mês (null sem nenhuma), para o acumulado dos importados. */
  importadas: Array<Map<string, number> | null>;
  /** O acumulado de janeiro até `ate` (1 a 12). */
  acumulado: (i: IndicadorDoCenario, ate: number) => number | null;
};

/** Calcula os indicadores do cenário, mês a mês. */
export async function calcularCenario(cenarioId: string): Promise<CalculoDoCenario> {
  const prisma = getPrismaClient();
  const [cenario, dre, metas, estrutura] = await Promise.all([
    prisma.cenario.findUniqueOrThrow({ where: { id: cenarioId }, select: { ano: true, tipo: true } }),
    prisma.cenarioResultado.findMany({ where: { cenarioId }, select: { visao: true, mes: true, valor: true, linhaDRE: { select: { codigo: true } } } }),
    prisma.cenarioIndicador.findMany({ where: { cenarioId }, select: { nome: true, mes: true, valor: true, origem: true } }),
    prisma.indicadorEstrutura.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } }),
  ]);
  const porLinha = new Map(dre.map((r) => [`${r.mes}|${r.visao}|${r.linhaDRE.codigo}`, Number(r.valor)]));
  // No analítico, os quadros de lotação dos grupos de centros de custo.
  const analitico = cenario.tipo === "ANALITICO";
  let quadros: Map<string, Array<number | null>> | null = null;
  if (analitico) {
    const [grupos, lotacao] = await Promise.all([gruposDoCadastro(), prisma.cenarioPremissa.findMany({ where: { cenarioId, venda: VENDA_LOTACAO } })]);
    const porGrupo = new Map<string, number[]>();
    for (const p of lotacao) {
      if (p.mes < 1 || p.mes > 12) continue;
      const lista = porGrupo.get(p.chave) ?? Array<number>(12).fill(0);
      lista[p.mes - 1] = Number(p.valor);
      porGrupo.set(p.chave, lista);
    }
    quadros = quadrosDeLotacao(grupos, porGrupo);
  }
  const mesesComDRE = Array.from({ length: 12 }, (_, k) => dre.some((r) => r.mes === k + 1));
  const porMeta = new Map(metas.map((m) => [`${m.mes}|${m.nome}`, { valor: Number(m.valor), digitado: m.origem === "DIGITADO" }]));
  const importadas = Array.from({ length: 12 }, (_, k) => {
    const doMes = metas.filter((m) => m.mes === k + 1);
    return doMes.length ? new Map(doMes.map((m) => [m.nome, Number(m.valor)])) : null;
  });

  const dados: DadosDoMes[] = Array.from({ length: 12 }, (_, k) => {
    const mes = k + 1;
    const temDRE = mesesComDRE[k];
    return {
      dre: (u, c) => (temDRE ? (porLinha.get(`${mes}|${u}|${c}`) ?? 0) : NaN),
      volume: () => NaN,
      lista: () => NaN,
      importado: (n) => (quadros?.has(n) ? quadros.get(n)![k] : (porMeta.get(`${mes}|${n}`)?.valor ?? null)),
      meta: () => null,
    };
  });

  const indicadores = estrutura.map((r): IndicadorDoCenario => {
    const indicador = montarIndicador(r);
    const classe = classificar(r, analitico);
    const partes =
      classe === "IMPORTADO"
        ? importadas.map((m) => (m ? { valor: m.get(r.nome) ?? null } : null))
        : dados.map((d) => indicador.calculo(d));
    return { indicador, classe, partes, digitados: Array.from({ length: 12 }, (_, k) => classe === "MANUAL" && !!porMeta.get(`${k + 1}|${r.nome}`)?.digitado) };
  });

  return {
    ano: cenario.ano,
    mesesComDRE,
    indicadores,
    importadas,
    acumulado: (i, ate) => {
      if (i.classe === "IMPORTADO") {
        const meses = importadas.slice(0, ate);
        return meses.every((m) => m !== null) ? acumularMeta(i.indicador, meses) : null;
      }
      return acumular(i.indicador, i.partes.slice(0, ate));
    },
  };
}

/** As metas orçadas de cada mês (todos os indicadores com valor), como Resultados Realizados lê o orçado. */
export function metasPorMes(c: CalculoDoCenario): Array<Map<string, number> | null> {
  return Array.from({ length: 12 }, (_, k) => {
    const m = new Map<string, number>();
    for (const i of c.indicadores) {
      const v = i.partes[k]?.valor;
      if (v !== null && v !== undefined) m.set(i.indicador.nome, v);
    }
    return m.size ? m : null;
  });
}

/** O cenário com a marcação no exercício (o Orçamento Empresarial dá o orçado de Resultados Realizados). */
export async function cenarioMarcado(ano: number, marcacao: MarcacaoCenario) {
  return getPrismaClient().cenario.findFirst({ where: { ano, marcacao }, select: { id: true, nome: true } });
}
