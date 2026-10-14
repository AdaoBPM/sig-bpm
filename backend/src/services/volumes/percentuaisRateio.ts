import { Prisma } from "../../generated/prisma/client.js";
import type { CodigoTotais } from "./totaisOperacao.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Percentuais de rateio — a aba Rateios do SIG BPM 2026 - BASE REALIZADO
 * (OPERAÇÃO): cada destino recebe o seu volume dividido pela soma da chave,
 * ou zero quando a chave não teve volume no mês.
 *
 * Com o percentual fixo da regra (14/10/2026), o destino fica com ele, e o volume continua apurado (os indicadores
 * de volume leem dele).
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
  /** O percentual fixo (14/10/2026; 0 a 1): no lugar do volume sobre o total da chave. */
  fixo?: Decimal | null;
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
    if (r.fixo !== null && r.fixo !== undefined) return { ...r, quantidade, totalChave, percentual: new Decimal(r.fixo) };
    return { ...r, quantidade, totalChave, percentual: totalChave.isZero() ? new Decimal(0) : quantidade.div(totalChave) };
  });
}
