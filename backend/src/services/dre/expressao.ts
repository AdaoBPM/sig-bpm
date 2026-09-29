import { Prisma } from "../../generated/prisma/client.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Avaliador das expressões dos subtotais e totais da estrutura da DRE: códigos
 * de linha somados e subtraídos, parênteses e SUM(a, b, …) — o que a carga
 * gera a partir das fórmulas da aba Realizado (Consolidado).
 */
export function avaliarExpressao(expressao: string, valor: (codigo: string) => Decimal): Decimal {
  const tokens = expressao.match(/SUM\(|[A-Za-z0-9_.]+|[-+(),]/g) ?? [];
  let i = 0;
  const olhar = () => tokens[i];
  const comer = (esperado?: string) => {
    const t = tokens[i++];
    if (esperado !== undefined && t !== esperado) throw new Error(`Expressão inválida: "${expressao}" (esperado ${esperado}, veio ${t ?? "fim"})`);
    return t;
  };
  function soma(): Decimal {
    let v = termo();
    while (olhar() === "+" || olhar() === "-") {
      const op = comer();
      const d = termo();
      v = op === "+" ? v.plus(d) : v.minus(d);
    }
    return v;
  }
  function termo(): Decimal {
    const t = comer();
    if (t === "-") return termo().neg();
    if (t === "+") return termo();
    if (t === "(") {
      const v = soma();
      comer(")");
      return v;
    }
    if (t === "SUM(") {
      let v = soma();
      while (olhar() === ",") {
        comer(",");
        v = v.plus(soma());
      }
      comer(")");
      return v;
    }
    if (t === undefined) throw new Error(`Expressão inválida: "${expressao}"`);
    if (/^\d+(\.\d+)?$/.test(t)) return new Decimal(t);
    return valor(t);
  }
  const v = soma();
  if (i < tokens.length) throw new Error(`Expressão inválida: "${expressao}" (sobra "${tokens.slice(i).join("")}")`);
  return v;
}

/** Códigos citados numa expressão, para ordenar a avaliação. */
export function codigosDaExpressao(expressao: string): string[] {
  return (expressao.match(/SUM\(|[A-Za-z0-9_.]+/g) ?? []).filter((t) => t !== "SUM(" && !/^\d+(\.\d+)?$/.test(t));
}
