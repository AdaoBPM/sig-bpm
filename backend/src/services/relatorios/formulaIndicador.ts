/**
 * A fórmula de um indicador (cadastro Estrutura dos Indicadores, 11/10/2026): operadores + − × ÷, parênteses,
 * números e quatro tipos de item, gravados entre colchetes:
 *
 * - [DRE|u|código]: uma linha da DRE apurada (qualquer tipo) na visão u — 0 Consolidado, 1 Matriz, 2 Filial,
 *   3 Serviços, 4 Despesas e Extra, 5 RN;
 * - [LISTA|código]: um totalizador das Listas Operacionais (Projetos Liberados: Matriz…; os "_TOTAL" somam a lista);
 * - [IND|nome]: um indicador importado ou digitado das abas Comercial e Administrativo (Venda: Total, Quadro de
 *   Lotação…);
 * - [META|nome]: a meta do mês de um indicador no cenário Orçamento Empresarial do exercício (zero sem ele);
 * - [INDICADOR|nome]: um indicador da Estrutura dos Indicadores — só na Metodologia dos itens do Painel de Bordo
 *   (17/10/2026), onde o realizado usa o valor do indicador e o orçado, a meta dele.
 *
 * O valor do mês é a fórmula com os itens do mês; sem dado em algum item (mês não apurado, indicador não importado)
 * ou com divisão por zero, o indicador fica sem valor. O acumulado depende do modo do indicador (indicadores.ts).
 */

export type Item =
  | { tipo: "DRE"; unidade: number; codigo: string }
  | { tipo: "LISTA"; codigo: string }
  | { tipo: "IND"; nome: string }
  | { tipo: "META"; nome: string }
  | { tipo: "INDICADOR"; nome: string };

type Token = { t: "num"; v: number } | { t: "item"; chave: string; item: Item } | { t: "op"; v: "+" | "-" | "*" | "/" } | { t: "(" } | { t: ")" };

type No = { k: "num"; v: number } | { k: "item"; chave: string } | { k: "neg"; a: No } | { k: "bin"; op: "+" | "-" | "*" | "/"; a: No; b: No };

export class FormulaInvalidaError extends Error {}

/** O item de um trecho entre colchetes ("DRE|1|CPP…"), ou erro. */
export function lerItem(texto: string): Item {
  const [tipo, ...resto] = texto.split("|");
  if (tipo === "DRE" && resto.length === 2 && /^[0-5]$/.test(resto[0]) && resto[1]) return { tipo, unidade: Number(resto[0]), codigo: resto[1] };
  if ((tipo === "LISTA" || tipo === "IND" || tipo === "META" || tipo === "INDICADOR") && resto.length === 1 && resto[0]) {
    return tipo === "LISTA" ? { tipo, codigo: resto[0] } : { tipo, nome: resto[0] };
  }
  throw new FormulaInvalidaError(`Item inválido na fórmula: [${texto}].`);
}

export const chaveDoItem = (i: Item) => (i.tipo === "DRE" ? `DRE|${i.unidade}|${i.codigo}` : i.tipo === "LISTA" ? `LISTA|${i.codigo}` : `${i.tipo}|${i.nome}`);

function tokens(formula: string): Token[] {
  const r: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const c = formula[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "[") {
      const fim = formula.indexOf("]", i);
      if (fim < 0) throw new FormulaInvalidaError("Falta fechar um item da fórmula (]).");
      const item = lerItem(formula.slice(i + 1, fim));
      r.push({ t: "item", chave: chaveDoItem(item), item });
      i = fim + 1;
    } else if (/[0-9.,]/.test(c)) {
      let j = i;
      while (j < formula.length && /[0-9.,]/.test(formula[j])) j++;
      const v = Number(formula.slice(i, j).replace(",", "."));
      if (!Number.isFinite(v)) throw new FormulaInvalidaError(`Número inválido na fórmula: ${formula.slice(i, j)}.`);
      r.push({ t: "num", v });
      i = j;
    } else if ("+-*/".includes(c)) {
      r.push({ t: "op", v: c as "+" | "-" | "*" | "/" });
      i++;
    } else if (c === "(" || c === ")") {
      r.push({ t: c });
      i++;
    } else {
      throw new FormulaInvalidaError(`Caractere inválido na fórmula: "${c}".`);
    }
  }
  return r;
}

/** A árvore da fórmula (precedência de × e ÷ sobre + e −; menos unário). */
function analisar(formula: string): { arvore: No; itens: Map<string, Item> } {
  const ts = tokens(formula);
  if (ts.length === 0) throw new FormulaInvalidaError("A fórmula está vazia.");
  const itens = new Map<string, Item>();
  let p = 0;
  const olhar = () => ts[p];
  function expr(): No {
    let a = termo();
    for (let t = olhar(); t && t.t === "op" && (t.v === "+" || t.v === "-"); t = olhar()) {
      p++;
      a = { k: "bin", op: t.v, a, b: termo() };
    }
    return a;
  }
  function termo(): No {
    let a = fator();
    for (let t = olhar(); t && t.t === "op" && (t.v === "*" || t.v === "/"); t = olhar()) {
      p++;
      a = { k: "bin", op: t.v, a, b: fator() };
    }
    return a;
  }
  function fator(): No {
    const t = ts[p++];
    if (!t) throw new FormulaInvalidaError("A fórmula termina num operador.");
    if (t.t === "num") return { k: "num", v: t.v };
    if (t.t === "item") {
      itens.set(t.chave, t.item);
      return { k: "item", chave: t.chave };
    }
    if (t.t === "op" && t.v === "-") return { k: "neg", a: fator() };
    if (t.t === "(") {
      const a = expr();
      if (ts[p++]?.t !== ")") throw new FormulaInvalidaError("Falta fechar um parêntese.");
      return a;
    }
    throw new FormulaInvalidaError("Operador ou parêntese fora do lugar na fórmula.");
  }
  const arvore = expr();
  if (p < ts.length) throw new FormulaInvalidaError("Sobram itens no fim da fórmula (falta um operador?).");
  return { arvore, itens };
}

function calcular(n: No, valor: (chave: string) => number): number {
  switch (n.k) {
    case "num":
      return n.v;
    case "item":
      return valor(n.chave);
    case "neg":
      return -calcular(n.a, valor);
    case "bin": {
      const a = calcular(n.a, valor);
      const b = calcular(n.b, valor);
      if (n.op === "+") return a + b;
      if (n.op === "-") return a - b;
      if (n.op === "*") return a * b;
      // Divisão por zero (ou sem dado) deixa o indicador sem valor.
      return Number.isFinite(b) && b !== 0 ? a / b : NaN;
    }
  }
}

/** A fórmula compilada: os itens que ela usa e a conta, com os valores dos itens (NaN quando não há dado). */
export type FormulaCompilada = { itens: Map<string, Item>; avaliar: (valor: (chave: string) => number) => number | null };

export function compilarFormula(formula: string): FormulaCompilada {
  const { arvore, itens } = analisar(formula);
  return {
    itens,
    avaliar: (valor) => {
      const r = calcular(arvore, valor);
      return Number.isFinite(r) ? r : null;
    },
  };
}

/** A fórmula por extenso, para a tela: os itens pelos nomes e ÷ e × no lugar de / e *. */
export function formulaPorExtenso(formula: string, rotulo: (i: Item) => string): string {
  return tokens(formula)
    .map((t) => (t.t === "item" ? rotulo(t.item) : t.t === "num" ? String(t.v).replace(".", ",") : t.t === "op" ? { "+": "+", "-": "−", "*": "×", "/": "÷" }[t.v] : t.t))
    .join(" ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")");
}
