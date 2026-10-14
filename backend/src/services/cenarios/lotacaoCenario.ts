import type { GrupoDoCenario } from "./centrosCenario.js";

/**
 * O quadro de lotação dos cenários analíticos (14/10/2026): os colaboradores de cada grupo de centros de custo, mês a
 * mês (a tabela Quadro de Lotação na aba Centros de Custo das Premissas), gravados nas premissas com a venda LOTACAO e
 * a chave o nome do grupo. Os indicadores de quadro de lotação do cenário saem deles, pela classificação do grupo:
 *
 * - Direta ou Indireta: a atribuição mais comum dos centros do grupo;
 * - Matriz ou Filial: nos custos de produção (CPP), o balde MATRIZ ou FILIAL; nos demais (Unidade e os de rateio), a
 *   filial em que os centros do grupo mais lançaram;
 * - Montagem: os grupos dos custos de montagem (CSM);
 * - as despesas (DA, DC, DL, DT) e os grupos sem atribuição entram só no Quadro de Lotação Total.
 *
 * MO Direta Total e MO Indireta Total = Matriz + Filial; MO Geral = Direta + Indireta; Quadro de Lotação Total = todos
 * os grupos. Com eles, as eficiências (volume e receita por colaborador) se calculam como no realizado.
 */

export const VENDA_LOTACAO = "LOTACAO";

type Local = "Matriz" | "Filial" | "Montagem";
type Atribuicao = "Direta" | "Indireta";
const LOCAIS: Local[] = ["Matriz", "Filial", "Montagem"];
const ATRIBUICOES: Atribuicao[] = ["Direta", "Indireta"];
const nomeQuadro = (a: Atribuicao | "Geral", l: Local | "Total") => `Quadro de Lotação: MO ${a} ${l}`;
export const QUADRO_TOTAL = "Quadro de Lotação Total";

/** Os indicadores de quadro de lotação que o analítico calcula pelos centros. */
export const QUADROS_DE_LOTACAO = new Set([
  ...(["Direta", "Indireta", "Geral"] as const).flatMap((a) => (["Matriz", "Filial", "Total", "Montagem"] as const).map((l) => nomeQuadro(a, l))),
  QUADRO_TOTAL,
]);

/** Onde o grupo entra no quadro de lotação: o local e a atribuição (sem um deles, só no Quadro de Lotação Total). */
export function quadroDoGrupo(g: Pick<GrupoDoCenario, "grupoDRE" | "balde" | "unidade" | "atribuicao">): { local: Local | null; atribuicao: Atribuicao | null; descricao: string } {
  const atribuicao: Atribuicao | null = g.atribuicao === "DIRETA" ? "Direta" : g.atribuicao === "INDIRETA" ? "Indireta" : null;
  const local: Local | null = g.grupoDRE === "CSM" ? "Montagem" : g.grupoDRE === "CPP" ? (g.balde === "MATRIZ" ? "Matriz" : g.balde === "FILIAL" ? "Filial" : g.unidade === 2 ? "Filial" : "Matriz") : null;
  if (!local || !atribuicao) return { local: null, atribuicao: null, descricao: `${QUADRO_TOTAL} (${!local ? "despesas" : "sem atribuição"})` };
  const curto = (x: string) => x.replace("Quadro de Lotação: ", "");
  return {
    local,
    atribuicao,
    descricao: `${[nomeQuadro(atribuicao, local), nomeQuadro("Geral", local), ...(local === "Montagem" ? [] : [nomeQuadro(atribuicao, "Total"), nomeQuadro("Geral", "Total")])].map(curto).join(", ")} e ${QUADRO_TOTAL}`,
  };
}

/**
 * Os quadros de lotação do cenário, mês a mês, pelos colaboradores dos grupos (`lotacao`: grupo → os doze meses). Um
 * mês sem colaboradores num quadro fica nulo (sem quadro, as eficiências dele não se calculam).
 */
export function quadrosDeLotacao(grupos: Array<Pick<GrupoDoCenario, "grupo" | "grupoDRE" | "balde" | "unidade" | "atribuicao">>, lotacao: Map<string, number[]>) {
  const somas = new Map<string, number[]>();
  const somar = (nome: string, k: number, v: number) => {
    const lista = somas.get(nome) ?? Array<number>(12).fill(0);
    lista[k] += v;
    somas.set(nome, lista);
  };
  for (const g of grupos) {
    const valores = lotacao.get(g.grupo);
    if (!valores) continue;
    const q = quadroDoGrupo(g);
    valores.forEach((v, k) => {
      if (!v) return;
      somar(QUADRO_TOTAL, k, v);
      if (!q.local || !q.atribuicao) return;
      somar(nomeQuadro(q.atribuicao, q.local), k, v);
      somar(nomeQuadro("Geral", q.local), k, v);
      if (q.local !== "Montagem") {
        somar(nomeQuadro(q.atribuicao, "Total"), k, v);
        somar(nomeQuadro("Geral", "Total"), k, v);
      }
    });
  }
  return new Map([...QUADROS_DE_LOTACAO].map((nome) => [nome, (somas.get(nome) ?? Array<number>(12).fill(0)).map((v) => (v ? v : null))]));
}

/** Arredonda as partes para inteiros que somam o total arredondado (o maior resto fica com a sobra). */
function inteiros(total: number, partes: Map<string, number>) {
  const alvo = Math.round(total);
  const soma = [...partes.values()].reduce((s, v) => s + v, 0);
  const brutos = [...partes].map(([k, v]) => ({ k, v: soma ? (v / soma) * alvo : alvo / partes.size }));
  const r = new Map(brutos.map((b) => [b.k, Math.floor(b.v)]));
  let sobra = alvo - [...r.values()].reduce((s, v) => s + v, 0);
  for (const b of [...brutos].sort((x, y) => y.v - Math.floor(y.v) - (x.v - Math.floor(x.v)))) {
    if (sobra <= 0) break;
    r.set(b.k, r.get(b.k)! + 1);
    sobra--;
  }
  return r;
}

/**
 * A lotação de um mês do realizado nos grupos (14/10/2026, a referência realizada): o realizado não tem os colaboradores
 * por centro, só os quadros (os indicadores); cada quadro de local e atribuição (MO Direta Matriz…) se divide entre os
 * grupos dele pelo peso de cada um (a mão de obra do grupo no mês) e o que o Quadro de Lotação Total tem a mais vai para
 * os grupos de despesas e sem atribuição, em colaboradores inteiros. Devolve a lotação de cada grupo e os quadros sem
 * grupo para recebê-los.
 */
export function distribuirLotacao(
  grupos: Array<Pick<GrupoDoCenario, "grupo" | "grupoDRE" | "balde" | "unidade" | "atribuicao">>,
  quadro: (nome: string) => number | null,
  pesos: Map<string, number>,
) {
  const r = new Map<string, number>();
  const semGrupo: string[] = [];
  let classificados = 0;
  const dividir = (nome: string, total: number, doQuadro: typeof grupos) => {
    if (!total) return;
    if (!doQuadro.length) {
      semGrupo.push(nome);
      return;
    }
    const partes = new Map(doQuadro.map((g) => [g.grupo, Math.max(0, pesos.get(g.grupo) ?? 0)]));
    for (const [g, v] of inteiros(total, partes)) if (v) r.set(g, (r.get(g) ?? 0) + v);
  };
  for (const local of LOCAIS)
    for (const atribuicao of ATRIBUICOES) {
      const nome = nomeQuadro(atribuicao, local);
      const total = quadro(nome) ?? 0;
      classificados += Math.round(total);
      dividir(
        nome,
        total,
        grupos.filter((g) => {
          const q = quadroDoGrupo(g);
          return q.local === local && q.atribuicao === atribuicao;
        }),
      );
    }
  const resto = (quadro(QUADRO_TOTAL) ?? 0) - classificados;
  if (resto > 0) dividir(QUADRO_TOTAL, resto, grupos.filter((g) => !quadroDoGrupo(g).local || !quadroDoGrupo(g).atribuicao));
  return { lotacao: r, semGrupo };
}
