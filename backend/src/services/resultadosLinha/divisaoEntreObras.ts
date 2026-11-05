import type { CodigoTotais } from "../volumes/totaisOperacao.js";
import { porPesos } from "./alocacaoNasLinhas.js";
import type { ItemDaReceita, Volume } from "./basesDasLinhas.js";

/**
 * O Realizado por Obra (03/11/2026, pedido do Adão): a etapa Linhas divide também o valor de cada linha entre as obras dela.
 * O direto vai inteiro à obra — a receita (pela Receita Prévia da obra), os lançamentos dos centros de obra e os volumes das
 * listas —, e o rateio da linha (os custos que não vieram dos centros de obra) vai às obras pelas bases da etapa Linhas
 * (decisão do Adão): os custos de produção pelo m³ produzido da obra, a Montagem pelo m³ montado, os demais serviços e os
 * custos complementares (CSC, em qualquer linha) pelos dias de acompanhamento e as despesas variáveis de venda pela receita
 * bruta. Sem base no mês, a do exercício até ele; sem
 * nenhuma, Sem Obra. As obras genéricas (Estoque Matriz, Depósito de Estacas, Unidade 2) ficam fora da base do rateio
 * (decisão do Adão): ele vai só às obras vendidas, e as genéricas ficam com o direto delas.
 */

/** A obra do valor que nenhuma base levou a uma obra (e o direto de um centro de obra sem a obra no cadastro). */
export const SEM_OBRA = "SEM_OBRA";

/** Linha (o id, ou a Sem Linha da unidade) → obra (o id, ou Sem Obra) → código da DRE → o valor e a parte direta dele. */
export type ValoresDasObras = Map<string, Map<string, Map<string, { valor: number; direto: number }>>>;

export function somarNaObra(alvo: ValoresDasObras, linha: string, obra: string, codigo: string, valor: number, direto: boolean) {
  if (Math.abs(valor) < 1e-12) return;
  const daLinha = alvo.get(linha) ?? new Map<string, Map<string, { valor: number; direto: number }>>();
  const daObra = daLinha.get(obra) ?? new Map<string, { valor: number; direto: number }>();
  const atual = daObra.get(codigo) ?? { valor: 0, direto: 0 };
  daObra.set(codigo, { valor: atual.valor + valor, direto: atual.direto + (direto ? valor : 0) });
  daLinha.set(obra, daObra);
  alvo.set(linha, daLinha);
}

/** As bases do rateio de uma linha entre as obras. */
export type BaseDaObra = "M3_PRODUZIDO" | "KG_METALURGIA" | "M3_MONTAGEM" | "DIAS_ACOMPANHAMENTO" | "RECEITA";

const TOTAIS_DA_BASE: Record<Exclude<BaseDaObra, "RECEITA">, (t: CodigoTotais) => boolean> = {
  M3_PRODUZIDO: (t) => t === "PREFABRICADO_MATRIZ" || t === "PREFABRICADO_FILIAL",
  KG_METALURGIA: (t) => t.startsWith("METALURGIA_"),
  M3_MONTAGEM: (t) => t === "MONTAGEM",
  DIAS_ACOMPANHAMENTO: (t) => t.startsWith("ACOMPANHAMENTO_"),
};

/**
 * As bases do rateio de um custo da linha, na ordem (a primeira com volume vale): as despesas variáveis de venda pela receita
 * bruta; os custos de serviços complementares (CSC), em qualquer linha, só pelos dias de acompanhamento (03/11/2026, pedido do
 * Adão; antes, na linha Montagem, pelo m³ montado); os demais custos de Serviços, na Montagem pelo m³ montado e nas demais
 * linhas pelos dias de acompanhamento (uma na falta da outra); na Matriz e na Filial, pelo m³ produzido e, na falta, pelos kg
 * da metalurgia.
 */
export function basesDoRateio(grupo: string, unidade: number, codigoDaLinha: string): BaseDaObra[] {
  if (grupo === "DVV") return ["RECEITA"];
  if (grupo === "CSC") return ["DIAS_ACOMPANHAMENTO"];
  if (unidade === 3) return codigoDaLinha === "MONTAGEM" ? ["M3_MONTAGEM", "DIAS_ACOMPANHAMENTO"] : ["DIAS_ACOMPANHAMENTO", "M3_MONTAGEM"];
  return ["M3_PRODUZIDO", "KG_METALURGIA"];
}

/**
 * Os pesos das obras de uma linha numa base (obra → volume ou receita bruta), sem as genéricas e sem os registros sem obra; só
 * os positivos. `obraDaReceita`: a obra (o id) de um código da Receita Prévia.
 */
export function pesosDasObras(
  base: BaseDaObra,
  linhaId: string,
  dados: { volumes: Volume[]; receita: ItemDaReceita[] },
  genericas: Set<string>,
  obraDaReceita: (codigo: string | null) => string,
): Map<string, number> {
  const pesos = new Map<string, number>();
  const somar = (obra: string, v: number) => {
    if (obra === SEM_OBRA || genericas.has(obra)) return;
    pesos.set(obra, (pesos.get(obra) ?? 0) + v);
  };
  if (base === "RECEITA") {
    // A receita das devoluções é negativa: não é base.
    for (const i of dados.receita) if (i.linhaId === linhaId && i.natureza !== "DEVOLUCOES_INVENTARIOS") somar(obraDaReceita(i.obraCodigo), i.bruta);
  } else {
    const daBase = TOTAIS_DA_BASE[base];
    for (const v of dados.volumes) if (v.linhaId === linhaId && v.obraId && daBase(v.total)) somar(v.obraId, v.quantidade);
  }
  for (const [o, v] of pesos) if (!(v > 0)) pesos.delete(o);
  return pesos;
}

/** O rateio dividido pelos primeiros pesos que houver (os do mês, depois os do exercício); sem nenhum, Sem Obra. */
export function ratearEntreObras(rateado: number, pesos: Array<() => Map<string, number>>): Array<[string, number]> {
  for (const p of pesos) {
    const divisao = porPesos(rateado, p());
    if (divisao.length) return divisao;
  }
  return [[SEM_OBRA, rateado]];
}

/** Um valor dividido pelos pesos das obras; sem pesos (ou com a soma zero), inteiro na Sem Obra. */
export function dividirPelasObras(valor: number, pesos: Map<string, number>): Array<[string, number]> {
  const divisao = porPesos(valor, pesos);
  return divisao.length ? divisao : [[SEM_OBRA, valor]];
}
