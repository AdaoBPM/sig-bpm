/**
 * A divisão de um valor da DRE entre as linhas, nos Resultados por Linha (26/10/2026): a tarefa das requisições e das
 * notas fiscais leva a parte que os documentos explicam; o resto vai, inteiro, para o primeiro passo que tiver pesos — a
 * regra do centro, a obra, a regra do rateio e o volume da unidade, nesta ordem (a Alocação nas Linhas) —, e o que
 * nenhum passo leva fica Sem Linha. Cada parte guarda o passo, para a Conferência.
 */

export type Nivel = "RECEITA" | "TAREFA" | "CENTRO" | "OBRA" | "RATEIO" | "UNIDADE" | "SEM_LINHA";

export const ROTULO_DO_NIVEL: Record<Nivel, string> = {
  RECEITA: "Receita Prévia",
  TAREFA: "Tarefa",
  CENTRO: "Regra do Centro",
  OBRA: "Obra",
  RATEIO: "Regra do Rateio",
  UNIDADE: "Volume da Unidade",
  SEM_LINHA: "Sem Linha",
};

/** A chave da linha Sem Linha de uma unidade (o que nenhum passo levou a uma linha). */
export const semLinha = (unidade: number) => `SEM_LINHA|${unidade}`;

export type Parte = { linhaId: string; nivel: Nivel; valor: number };

/** Um passo: o nível e os pesos das linhas (vazio ou nulo, o passo não leva nada e vale o próximo). */
export type Passo = { nivel: Nivel; pesos: () => Map<string, number> | null };

/** O valor dividido pelos pesos, na proporção (os pesos somados não podem ser zero). */
export function porPesos(valor: number, pesos: Map<string, number>): Array<[string, number]> {
  const soma = [...pesos.values()].reduce((s, p) => s + p, 0);
  if (!soma) return [];
  return [...pesos].map(([l, p]) => [l, (valor * p) / soma]);
}

/**
 * As frações da tarefa num grupo de documentos (a mesma conta, centro e filial do balancete): cada linha fica com os
 * documentos da tarefa dela sobre o maior entre o valor do balancete e o dos documentos — os documentos explicam só a
 * parte deles, e o resto segue a ordem. Sem valor positivo no balancete ou nos documentos com tarefa, nenhuma.
 */
export function fracoesDaTarefa(totalDoBalancete: number, comTarefa: Map<string, number>, semTarefa: number): Map<string, number> {
  const positivos = [...comTarefa].filter(([, v]) => v > 0);
  const soma = positivos.reduce((s, [, v]) => s + v, 0);
  if (!(totalDoBalancete > 0) || !(soma > 0)) return new Map();
  const base = Math.max(totalDoBalancete, soma + Math.max(semTarefa, 0));
  return new Map(positivos.map(([l, v]) => [l, v / base]));
}

/** Divide o valor: as frações da tarefa e, para o resto, o primeiro passo com pesos; sem nenhum, Sem Linha. */
export function alocar(valor: number, tarefa: Map<string, number>, passos: Passo[], chaveSemLinha: string): Parte[] {
  const partes: Parte[] = [];
  let resto = valor;
  for (const [linhaId, f] of tarefa) {
    const v = valor * f;
    partes.push({ linhaId, nivel: "TAREFA", valor: v });
    resto -= v;
  }
  if (Math.abs(resto) < 1e-9) return partes;
  for (const p of passos) {
    const pesos = p.pesos();
    const divisao = pesos?.size ? porPesos(resto, pesos) : [];
    if (divisao.length) {
      for (const [linhaId, v] of divisao) partes.push({ linhaId, nivel: p.nivel, valor: v });
      return partes;
    }
  }
  partes.push({ linhaId: chaveSemLinha, nivel: "SEM_LINHA", valor: resto });
  return partes;
}

/** O número de uma obra (do código dela, G829003, ou do centro de obra, 1.98.00829003): os dígitos, sem os zeros à esquerda. */
export const numeroDaObra = (codigo: string | null | undefined) => (codigo ?? "").split(".").pop()!.replace(/\D/g, "").replace(/^0+/, "");
