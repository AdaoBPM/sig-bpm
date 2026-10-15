import type { LinhaEstrutura } from "../dre/apuracaoUnidades.js";
import { linhasDaUnidade, linhasDoConsolidado, UNIDADES } from "./edicaoCenario.js";

/**
 * O comparativo entre cenários (12/10/2026): um cenário se compara com outro, e cada conta da DRE tem uma variação
 * máxima (em %). As contas de cada visão (Consolidado e unidades) cuja variação mensal passa da variação máxima delas
 * pedem justificativa (tela Justificativas).
 *
 * A Variação Máxima segue a estrutura da DRE vigente (14/10/2026; antes, só os totais): totais, atribuições e contas,
 * no mesmo contorno de NiveisDRE, no frontend. Os totais são as linhas que não são conta nem seção e cujo código abre
 * um grupo; as atribuições, as de três partes do grupo; cada conta fica sob o último total (e a última atribuição do
 * mesmo prefixo) antes dela. Verificam-se as linhas sem nada embaixo: as contas e as atribuições sem contas. A variação
 * de um total ou de uma atribuição vale para as contas abaixo dele: grava-se em cada conta.
 *
 * Desde 15/10/2026: a seção Produção e Serviços (PS) entra, com a Produção (P) e os Serviços (S) como atribuições e os
 * volumes como contas; e os totais sem contas embaixo, que só somam outros totais (CPV, MB, MC, DFO, EBITDA, EBIT,
 * NOPAT, RF, DF e RL), saem: não são premissa de nada diretamente.
 */

export type TotalDaDRE = { codigo: string; descricao: string };
export type ContaComparada = { linha: LinhaEstrutura; total: TotalDaDRE };
/** Uma linha da Variação Máxima: o nível (0 total, 1 atribuição ou conta de um total, 2 conta de uma atribuição) e os grupos acima. */
export type LinhaDaVariacao = { linha: LinhaEstrutura; nivel: number; acima: string[]; folha: boolean };

/**
 * A estrutura da Variação Máxima: as linhas (a seção Produção e Serviços com os volumes; sem a primeira ROL, o total
 * repetido mais adiante na DRE, e sem os totais que só somam outros totais), os totais e as linhas verificadas, cada uma
 * com o total acima dela.
 */
export function totaisDaDRE(est: LinhaEstrutura[]): { totais: TotalDaDRE[]; verificadas: ContaComparada[]; linhas: LinhaDaVariacao[] } {
  const semSecoes = est.filter((l) => l.tipo !== "SECAO");
  const primeiro = semSecoes.findIndex((l) => l.tipo !== "ITEM");
  const todas = primeiro < 0 ? [] : semSecoes.slice(primeiro);
  const partes = (c: string) => c.split(".");
  const abremGrupo = new Set(todas.filter((l) => l.tipo !== "ITEM" && partes(l.codigo).length === 2).map((l) => partes(l.codigo)[0]));
  const ehTotal = (l: LinhaEstrutura) => l.tipo !== "ITEM" && !(partes(l.codigo).length > 2 && abremGrupo.has(partes(l.codigo)[0]));
  // A primeira ROL (14/10/2026): o total com a mesma descrição de um total mais adiante sai da lista.
  const ultimoTotal = new Map(todas.filter(ehTotal).map((l) => [l.descricao, l.codigo]));
  const linhas = todas.filter((l) => !ehTotal(l) || ultimoTotal.get(l.descricao) === l.codigo);
  const atribuicoes = new Set(linhas.filter((l) => l.tipo !== "ITEM" && !ehTotal(l)).map((l) => partes(l.codigo).slice(0, 2).join(".")));
  const nivelDe = (l: LinhaEstrutura) =>
    ehTotal(l) ? 0 : l.tipo !== "ITEM" ? 1 : partes(l.codigo).length > 2 && atribuicoes.has(partes(l.codigo).slice(0, 2).join(".")) ? 2 : 1;
  const resultado: LinhaDaVariacao[] = [];
  const comFilhos = new Set<string>();
  // Produção e Serviços (15/10/2026): as linhas antes do primeiro total; a seção PS é o total, as outras seções (P e S),
  // as atribuições, e os volumes, as contas.
  const antes = primeiro < 0 ? [] : est.slice(0, est.indexOf(semSecoes[primeiro]));
  const ps = antes.find((l) => l.tipo === "SECAO" && l.codigo.startsWith("PS."));
  if (ps) {
    let secao: LinhaEstrutura | null = null;
    for (const l of antes) {
      if (l === ps) resultado.push({ linha: l, nivel: 0, acima: [], folha: false });
      else if (l.tipo === "SECAO") {
        secao = l;
        resultado.push({ linha: l, nivel: 1, acima: [ps.codigo], folha: false });
      } else {
        const acima = [ps.codigo, ...(secao ? [secao.codigo] : [])];
        acima.forEach((g) => comFilhos.add(g));
        resultado.push({ linha: l, nivel: secao ? 2 : 1, acima, folha: false });
      }
    }
  }
  let total: LinhaEstrutura | null = null;
  let atribuicao: LinhaEstrutura | null = null;
  for (const l of linhas) {
    const nivel = nivelDe(l);
    let acima: string[];
    if (nivel === 0) {
      acima = [];
      total = l;
      atribuicao = null;
    } else if (nivel === 1) {
      acima = total ? [total.codigo] : [];
      atribuicao = l.tipo === "ITEM" ? null : l;
    } else acima = [total?.codigo, atribuicao?.codigo].filter((x): x is string => !!x);
    for (const g of acima) comFilhos.add(g);
    resultado.push({ linha: l, nivel, acima, folha: false });
  }
  for (const r of resultado) r.folha = !comFilhos.has(r.linha.codigo);
  // Os totais sem nada embaixo só somam outros totais (CPV, MB, MC, DFO, EBITDA, EBIT, NOPAT, RF, DF e RL): saem (15/10/2026).
  const somas = new Set(resultado.filter((r) => r.nivel === 0 && r.folha).map((r) => r.linha.codigo));
  for (let i = resultado.length - 1; i >= 0; i--) if (somas.has(resultado[i].linha.codigo)) resultado.splice(i, 1);
  const porCodigo = new Map([...antes, ...linhas].map((l) => [l.codigo, l]));
  const totais = resultado.filter((r) => r.nivel === 0).map((r) => ({ codigo: r.linha.codigo, descricao: r.linha.descricao }));
  const verificadas = resultado
    .filter((r) => r.folha)
    .map((r) => {
      const t = r.nivel === 0 ? r.linha : porCodigo.get(r.acima[0])!;
      return { linha: r.linha, total: { codigo: t.codigo, descricao: t.descricao } };
    });
  return { totais, verificadas, linhas: resultado };
}

/**
 * A variação máxima de uma linha verificada: a dela ou, sem ela, a da atribuição e a do total acima (as variações
 * gravadas por total, antes de 14/10/2026, valem para as contas dele até a próxima gravação).
 */
export function limiteDaLinha(limites: Record<string, number>, codigo: string, acima: string[]): number | null {
  for (const c of [codigo, ...[...acima].reverse()]) if (typeof limites[c] === "number") return limites[c];
  return null;
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
