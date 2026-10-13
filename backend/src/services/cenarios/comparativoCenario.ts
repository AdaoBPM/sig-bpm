import type { LinhaEstrutura } from "../dre/apuracaoUnidades.js";
import { linhasDaUnidade, linhasDoConsolidado, UNIDADES } from "./edicaoCenario.js";

/**
 * O comparativo entre cenários (12/10/2026): um cenário se compara com outro, e cada total da DRE tem uma variação
 * máxima (em %). As contas de cada visão (Consolidado e unidades) cuja variação mensal passa da variação máxima do
 * total delas pedem justificativa (tela Justificativas).
 *
 * Os totais são os do nível Totais da DRE (o mesmo contorno de NiveisDRE, no frontend): as linhas que não são conta
 * nem seção e cujo código abre um grupo. Cada conta fica sob o último total antes dela, na ordem da DRE. O total sem
 * contas embaixo (MB, MC, EBITDA, RL…) é verificado ele mesmo.
 */

export type TotalDaDRE = { codigo: string; descricao: string };
export type ContaComparada = { linha: LinhaEstrutura; total: TotalDaDRE };

/** Os totais da DRE e as linhas que cada um verifica: as contas embaixo dele ou, sem contas, ele mesmo. */
export function totaisDaDRE(est: LinhaEstrutura[]): { totais: TotalDaDRE[]; verificadas: ContaComparada[] } {
  const linhas = est.filter((l) => l.tipo !== "SECAO");
  const partes = (c: string) => c.split(".");
  const abremGrupo = new Set(linhas.filter((l) => l.tipo !== "ITEM" && partes(l.codigo).length === 2).map((l) => partes(l.codigo)[0]));
  const ehTotal = (l: LinhaEstrutura) => l.tipo !== "ITEM" && !(partes(l.codigo).length > 2 && abremGrupo.has(partes(l.codigo)[0]));
  const totais: TotalDaDRE[] = [];
  const contas = new Map<string, LinhaEstrutura[]>();
  let atual: TotalDaDRE | null = null;
  for (const l of linhas) {
    if (ehTotal(l)) {
      atual = { codigo: l.codigo, descricao: l.descricao };
      totais.push(atual);
      contas.set(l.codigo, []);
    } else if (l.tipo === "ITEM" && atual) contas.get(atual.codigo)!.push(l);
  }
  const porCodigo = new Map(linhas.map((l) => [l.codigo, l]));
  const verificadas = totais.flatMap((t) => {
    const cs = contas.get(t.codigo)!;
    return (cs.length ? cs : [porCodigo.get(t.codigo)!]).map((linha) => ({ linha, total: t }));
  });
  return { totais, verificadas };
}

export type MesComparado = { mes: number; valor: number; comparado: number; variacao: number | null };

/**
 * Os meses de uma linha acima da variação máxima: a variação é (valor − comparado) / |comparado|, em %; com o
 * comparado zero e o valor não, não há base (variação nula) e o mês entra. A variação se compara arredondada em
 * duas casas, como a tela a mostra (13/10/2026): um reajuste de 5% sobre valores em centavos dá 5,0000005%, que é
 * igual à máxima de 5,00%, não maior.
 */
export function mesesAcima(valores: Map<number, number>, comparados: Map<number, number>, limite: number): MesComparado[] {
  const meses: MesComparado[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const valor = valores.get(mes) ?? 0;
    const comparado = comparados.get(mes) ?? 0;
    if (Math.abs(valor - comparado) < 0.005) continue;
    const variacao = Math.abs(comparado) < 0.005 ? null : Math.round(((valor - comparado) / Math.abs(comparado)) * 10000) / 100;
    if (variacao === null || Math.abs(variacao) > limite) meses.push({ mes, valor, comparado, variacao });
  }
  return meses;
}

/** As linhas de cada visão: as do Consolidado e as de cada unidade. */
export function linhasDasVisoes(est: LinhaEstrutura[]): Map<number, Set<string>> {
  return new Map<number, Set<string>>([[0, linhasDoConsolidado(est)], ...UNIDADES.map((u) => [u, linhasDaUnidade(est, u)] as [number, Set<string>])]);
}
