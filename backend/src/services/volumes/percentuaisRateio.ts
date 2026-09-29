import { Prisma } from "../../generated/prisma/client.js";
import type { CodigoTotais } from "./totaisOperacao.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Percentuais de rateio — a aba Rateios do SIG BPM 2026 - BASE REALIZADO
 * (OPERAÇÃO): cada destino recebe o seu volume dividido pela soma da chave,
 * ou zero quando a chave não teve volume no mês.
 *
 * O vínculo é nominal: a regra diz de qual linha dos Totais vem o volume, e
 * não em que linha da planilha ela está. Reordenar o cadastro não muda nada.
 */

export type RegraCalculo = {
  id: string;
  chave: string;
  destino: string;
  /** Código da linha dos Totais que dá o volume do destino. */
  origem: CodigoTotais;
};

export type PercentualCalculado = RegraCalculo & { quantidade: Decimal; totalChave: Decimal; percentual: Decimal };

export function calcularPercentuais(regras: RegraCalculo[], totais: Map<string, Decimal>): PercentualCalculado[] {
  const totalPorChave = new Map<string, Decimal>();
  for (const r of regras) {
    totalPorChave.set(r.chave, (totalPorChave.get(r.chave) ?? new Decimal(0)).plus(totais.get(r.origem) ?? 0));
  }
  return regras.map((r) => {
    const quantidade = totais.get(r.origem) ?? new Decimal(0);
    const totalChave = totalPorChave.get(r.chave)!;
    return { ...r, quantidade, totalChave, percentual: totalChave.isZero() ? new Decimal(0) : quantidade.div(totalChave) };
  });
}
