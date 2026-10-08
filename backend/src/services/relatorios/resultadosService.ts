import { getPrismaClient } from "../../config/prisma.js";
import { ACESSO_TOTAL, type Acesso } from "../acesso/acesso.js";
import { podeVerMovimentos } from "../acesso/recorteDepartamento.js";
import { dreService, RegraDREError } from "../dre/dreService.js";
import { linhasDoCentro } from "../dre/recorteCentros.js";
import { baseDoPercentual, baseDoUnitario, basesDoConsolidado, COD, GRUPOS_DE_VOLUME, type VisaoResultados } from "./basesResultados.js";

/**
 * Relatório de Resultados: as visões da DRE (unidades, consolidado e centros
 * de custo) mês a mês no exercício, com a participação (%) e o valor unitário
 * (R$/m³) de cada linha, como as abas Resultados (…) do SIG BPM 2026 - BASE
 * REALIZADO (RESULTADOS). Os valores são os apurados (congelados) de cada
 * competência; o mês sem apuração fica vazio e não entra no total.
 */

export class RelatorioError extends Error {
  constructor(
    readonly status: 400 | 404,
    message: string,
  ) {
    super(message);
  }
}

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${String(ano).slice(2)}`;

type LinhaEstrutura = { id: string; codigo: string; tipo: string; grupo: string; grupoSigla: string; descricao: string };
type Celula = { valor: number | null; pct: number | null; unitario: number | null };

/** Os meses do exercício até `ate`, com a competência apurada de cada um (ou nenhuma). */
export async function mesesDoExercicio(ano: number, ate?: number) {
  const competencias = await getPrismaClient().competencia.findMany({
    where: { ano },
    select: { id: true, mes: true, apuradaEm: true },
    orderBy: { mes: "asc" },
  });
  const apuradas = competencias.filter((c) => c.apuradaEm !== null);
  if (apuradas.length === 0) throw new RelatorioError(404, `Nenhuma competência de ${ano} foi apurada.`);
  const ultimo = ate ?? apuradas[apuradas.length - 1].mes;
  return {
    ultimo,
    meses: Array.from({ length: ultimo }, (_, i) => {
      const c = apuradas.find((x) => x.mes === i + 1);
      return { mes: i + 1, rotulo: rotuloMes(ano, i + 1), competenciaId: c?.id ?? null };
    }),
  };
}

async function estrutura(): Promise<LinhaEstrutura[]> {
  return getPrismaClient().linhaDRE.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, codigo: true, tipo: true, grupo: true, grupoSigla: true, descricao: true },
  });
}

/** Valores por mês e código, de uma unidade (1..5) ou do consolidado (0). */
async function valoresDaVisao(competencias: Array<string | null>, unidade: number) {
  const ids = competencias.filter((c): c is string => c !== null);
  const rs = await getPrismaClient().resultadoApurado.findMany({
    where: { competenciaId: { in: ids }, centroCustoId: null, ...(unidade === 0 ? { unidadeNegocioId: null } : { unidadeNegocio: { codigo: unidade } }) },
    select: { competenciaId: true, valor: true, linhaDRE: { select: { codigo: true } } },
  });
  const porMes = competencias.map(() => new Map<string, number>());
  for (const r of rs) porMes[competencias.indexOf(r.competenciaId)].set(r.linhaDRE.codigo, Number(r.valor));
  return porMes;
}

// Valores com quatro casas (os volumes têm três) e razões com oito: sem o resíduo das somas em ponto flutuante.
const arredonda = (x: number, casas: number) => Math.round(x * 10 ** casas) / 10 ** casas;
const divide = (a: number, b: number | undefined) => (b === undefined || b === 0 ? null : arredonda(a / b, 8));
const soma = (xs: Array<number | null | undefined>) => arredonda(xs.reduce<number>((s, x) => s + (x ?? 0), 0), 4);

/**
 * Monta as linhas: os valores de cada mês, a participação e o valor unitário,
 * e o total do exercício (a soma dos meses apurados), com o % e o R$/m³ do
 * total sobre as bases somadas.
 */
function montar(
  linhas: LinhaEstrutura[],
  visao: VisaoResultados,
  apurado: boolean[],
  valores: Array<Map<string, number>>,
  bases: Array<Map<string, number>>,
  acesso: Acesso,
) {
  const temValor = new Set(valores.flatMap((m) => [...m.keys()]));
  return linhas
    .filter((l) => l.tipo === "SECAO" || temValor.has(l.codigo))
    .map((l) => {
      const volume = GRUPOS_DE_VOLUME.has(l.grupoSigla);
      const bp = baseDoPercentual(visao, l);
      const bu = baseDoUnitario(l);
      const meses: Celula[] = valores.map((m, i) => {
        if (l.tipo === "SECAO" || !apurado[i]) return { valor: null, pct: null, unitario: null };
        const v = arredonda(m.get(l.codigo) ?? 0, 4);
        return { valor: v, pct: bp ? divide(v, bases[i].get(bp)) : null, unitario: bu ? divide(v, bases[i].get(bu)) : null };
      });
      const total = l.tipo === "SECAO" ? null : soma(meses.map((c) => c.valor));
      const somaBase = (codigo: string | null) => (codigo ? soma(bases.map((b, i) => (apurado[i] ? b.get(codigo) : 0))) : undefined);
      return {
        codigo: l.codigo,
        tipo: l.tipo,
        grupo: l.grupo,
        grupoSigla: l.grupoSigla,
        descricao: l.descricao,
        volume,
        /** O usuário alcança os lançamentos da linha (o recorte do Gestor por departamento), como na DRE. */
        podeDetalhar: visao === "centros" || podeVerMovimentos(acesso, l),
        meses,
        total: {
          valor: total,
          pct: total !== null && bp ? divide(total, somaBase(bp)) : null,
          unitario: total !== null && bu ? divide(total, somaBase(bu)) : null,
        },
      };
    });
}

export const resultadosService = {
  /** Uma visão da DRE (0 Consolidado, 1..5 as unidades) mês a mês, até o mês `ate`. */
  async unidade(ano: number, visao: 0 | 1 | 2 | 3 | 4 | 5, ate?: number, acesso: Acesso = ACESSO_TOTAL) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const competencias = meses.map((m) => m.competenciaId);
    const [linhas, valores] = await Promise.all([estrutura(), valoresDaVisao(competencias, visao)]);
    const consolidado = basesDoConsolidado(visao) ? await valoresDaVisao(competencias, 0) : valores;
    // Em Despesas e Extra e no RN, a ROL do Consolidado abre a tabela, como nas abas da planilha.
    if (visao === 4 || visao === 5) valores.forEach((m, i) => consolidado[i].has(COD.RO) && m.set(COD.RO, consolidado[i].get(COD.RO)!));
    const apurado = meses.map((m) => m.competenciaId !== null);
    return { ano, ate: ultimo, meses: meses.map(({ mes, rotulo, competenciaId }) => ({ mes, rotulo, apurado: competenciaId !== null })), linhas: montar(linhas, visao, apurado, valores, consolidado, acesso) };
  },

  /** Os agrupamentos de centros de custo com valor em algum mês, com o total do exercício (o da tabela de cada um). */
  async listarCentros(ano: number, ate?: number, acesso: Acesso = ACESSO_TOTAL) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const grupos = new Map<string, { departamentos: Set<string>; total: number }>();
    for (const m of meses) {
      if (!m.competenciaId) continue;
      const { grupos: doMes } = await dreService.listarCentros(ano, m.mes, acesso);
      for (const g of doMes) {
        const x = grupos.get(g.grupo) ?? { departamentos: new Set<string>(), total: 0 };
        g.departamentos.forEach((d) => x.departamentos.add(d));
        x.total += Number(g.total);
        grupos.set(g.grupo, x);
      }
    }
    return {
      ano,
      ate: ultimo,
      grupos: [...grupos]
        .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
        .map(([grupo, g]) => ({ grupo, departamentos: [...g.departamentos].sort(), total: g.total.toFixed(2) })),
    };
  },

  /**
   * Um agrupamento de centros de custo mês a mês: em cada mês, o recorte da
   * tela da DRE (linhasDoCentro); as bases do % e do R$/m³ são as do Consolidado.
   */
  async centros(ano: number, grupo: string, ate?: number, acesso: Acesso = ACESSO_TOTAL) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate);
    const competencias = meses.map((m) => m.competenciaId);
    const [linhas, consolidado] = await Promise.all([estrutura(), valoresDaVisao(competencias, 0)]);
    // Os centros do agrupamento com lançamento em algum mês (o painel explicativo, como na DRE).
    const centros = new Map<string, { codigoRM: string | null; nome: string }>();
    const valores = await Promise.all(
      meses.map(async (m) => {
        const mapa = new Map<string, number>();
        if (!m.competenciaId) return mapa;
        try {
          const dre = await dreService.consultarCentros(ano, m.mes, grupo, acesso);
          for (const l of linhasDoCentro(dre.linhas)) if (l.valor !== null) mapa.set(l.codigo, Number(l.valor));
          for (const cc of dre.centros) centros.set(`${cc.codigoRM}|${cc.nome}`, cc);
        } catch (error) {
          if (!(error instanceof RegraDREError && error.status === 404)) throw error; // sem valor no mês
        }
        return mapa;
      }),
    );
    if (valores.every((m) => m.size === 0)) throw new RelatorioError(404, `Nenhum valor apurado para o centro de custo ${grupo} em ${ano}.`);
    const apurado = meses.map((m) => m.competenciaId !== null);
    return {
      ano,
      ate: ultimo,
      grupo,
      centros: [...centros.values()].sort((a, b) => (a.codigoRM ?? "").localeCompare(b.codigoRM ?? "")),
      meses: meses.map(({ mes, rotulo, competenciaId }) => ({ mes, rotulo, apurado: competenciaId !== null })),
      linhas: montar(linhas, "centros", apurado, valores, consolidado, acesso).filter((l) => l.tipo !== "SECAO"),
    };
  },
};
