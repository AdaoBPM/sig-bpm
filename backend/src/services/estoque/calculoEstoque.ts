import { Prisma } from "../../generated/prisma/client.js";
import type { CriterioReceita } from "../../generated/prisma/enums.js";
import { grupoDaEstaca, OBRAS_GENERICAS, pecaDaEstaca } from "../receitaPrevia/calculoReceita.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Saldo de estoque — as abas Estoque (Lista), Estoque (Saldo m³), Estoque
 * (Saldo R$) e Estoque (Médias) do SIG BPM 2026 - BASE PRÉVIAS (RECEITAS E
 * ESTOQUE). Serve para conferência e não entra no resultado.
 *
 * O movimento do mês, por obra e linha, é o volume produzido menos o
 * expedido. As estacas ficam todas no depósito (M9999). O valor do movimento
 * é, nas estacas, o da tabela de estacas (RL PROD.: entra na produção, sai na
 * expedição); nas demais linhas, o volume × preço líquido do contrato, ou o
 * padrão (3.500 por m³ na estrutura, 2.000 nas outras) para obra genérica ou
 * sem DRE. O saldo é o do mês anterior mais o movimento: o valor não é
 * reavaliado.
 */

export const OBRA_DEPOSITO_ESTACAS = "M9999";
const PRECO_PADRAO = { ESTRUTURA: 3500, OUTRAS: 2000 };

export type PrecoLiquidoVigente = { obra: string; versao: number; linha: string; contaResultado: string; valorUnitario: Decimal | null };
export type EstacaTabela = { grupo: string; secao: string; peca: string; precoLiquido: Decimal };
export type Movimento = { obra: string | null; linha: string | null; quantidade: Decimal; nomePeca?: string | null; secao?: string | null };
export type SaldoAnterior = { obra: string; linha: string; saldoVolume: Decimal; saldoValor: Decimal };

export type SaldoCalculado = {
  obra: string;
  linha: string;
  movimentoVolume: Decimal;
  movimentoValor: Decimal;
  saldoVolume: Decimal;
  saldoValor: Decimal;
  precoMedio: Decimal;
  /** Preço por m³ do movimento (nulo nas estacas, que vêm da tabela peça a peça). */
  precoMovimento: Decimal | null;
  criterio: CriterioReceita | null;
};

const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();
const zero = () => new Decimal(0);

export function calcularEstoque(d: {
  anterior: SaldoAnterior[];
  producoes: Movimento[];
  expedicoes: Movimento[];
  precos: PrecoLiquidoVigente[];
  estacas: EstacaTabela[];
}): { saldos: SaldoCalculado[]; avisos: string[] } {
  const obrasComDRE = new Set(d.precos.map((p) => norm(p.obra)));
  const precoLiquido = new Map<string, Decimal>();
  for (const p of d.precos) {
    if (p.versao !== 0 || norm(p.contaResultado) !== norm("Receita Líquida do Pré-Fabricado")) continue;
    const k = `${norm(p.obra)}|${norm(p.linha)}`;
    precoLiquido.set(k, (precoLiquido.get(k) ?? zero()).plus(p.valorUnitario ?? 0));
  }
  const estacaPorGrupoSecao = new Map(d.estacas.map((e) => [`${norm(e.grupo)}|${norm(e.secao)}`, e.precoLiquido]));
  const estacaPorPeca = new Map(d.estacas.map((e) => [norm(e.peca), e.precoLiquido]));

  type Acum = { obra: string; linha: string; volume: Decimal; valorEstaca: Decimal };
  const mov = new Map<string, Acum>();
  const acumular = (m: Movimento, sinal: 1 | -1, valorEstaca: Decimal) => {
    const linha = norm(m.linha);
    const obra = linha === "ESTACAS" ? OBRA_DEPOSITO_ESTACAS : norm(m.obra);
    const k = `${obra}|${linha}`;
    const a = mov.get(k) ?? { obra, linha, volume: zero(), valorEstaca: zero() };
    a.volume = sinal === 1 ? a.volume.plus(m.quantidade) : a.volume.minus(m.quantidade);
    a.valorEstaca = a.valorEstaca.plus(valorEstaca);
    mov.set(k, a);
  };
  const semTabela = new Set<string>();
  for (const p of d.producoes) {
    let v = zero();
    if (norm(p.linha) === "ESTACAS") {
      const preco = estacaPorGrupoSecao.get(`${grupoDaEstaca(p.nomePeca)}|${norm(p.secao)}`);
      if (!preco) semTabela.add(`${grupoDaEstaca(p.nomePeca)} ${p.secao ?? "?"}`);
      v = (preco ?? zero()).times(p.quantidade);
    }
    acumular(p, 1, v);
  }
  for (const e of d.expedicoes) {
    let v = zero();
    if (norm(e.linha) === "ESTACAS") {
      const preco = estacaPorPeca.get(pecaDaEstaca(e.nomePeca));
      if (!preco) semTabela.add(pecaDaEstaca(e.nomePeca));
      v = (preco ?? zero()).times(e.quantidade).neg();
    }
    acumular(e, -1, v);
  }

  const anterior = new Map(d.anterior.map((a) => [`${norm(a.obra)}|${norm(a.linha)}`, a]));
  const chaves = [...new Set([...anterior.keys(), ...mov.keys()])].sort();
  const saldos = chaves.map((k) => {
    const a = anterior.get(k);
    const m = mov.get(k);
    const [obra, linha] = k.split("|");
    let movimentoValor = zero();
    let precoMovimento: Decimal | null = null;
    let criterio: CriterioReceita | null = null;
    if (m) {
      if (linha === "ESTACAS") {
        movimentoValor = m.valorEstaca;
        criterio = "TABELA_ESTACA";
      } else {
        criterio = OBRAS_GENERICAS.has(obra) ? "GENERICA" : !obrasComDRE.has(obra) ? "SEM_CONTRATO" : "CONTRATO";
        precoMovimento =
          criterio === "CONTRATO"
            ? (precoLiquido.get(k) ?? zero())
            : new Decimal(linha === "ESTRUTURA" ? PRECO_PADRAO.ESTRUTURA : PRECO_PADRAO.OUTRAS);
        movimentoValor = m.volume.times(precoMovimento);
      }
    }
    const movimentoVolume = m?.volume ?? zero();
    const saldoVolume = (a?.saldoVolume ?? zero()).plus(movimentoVolume);
    const saldoValor = (a?.saldoValor ?? zero()).plus(movimentoValor);
    return {
      obra,
      linha,
      movimentoVolume,
      movimentoValor,
      saldoVolume,
      saldoValor,
      precoMedio: saldoVolume.isZero() ? zero() : saldoValor.div(saldoVolume),
      precoMovimento,
      criterio,
    };
  });
  const avisos = semTabela.size ? [`Estaca sem preço na tabela de estacas (valor zero): ${[...semTabela].sort().join(", ")}.`] : [];
  return { saldos, avisos };
}

/** Preço médio por linha e geral — a aba Estoque (Médias): Σ R$ / Σ m³, zero sem volume. */
export function mediasPorLinha(saldos: Array<{ linha: string; saldoVolume: Decimal; saldoValor: Decimal }>) {
  const media = (xs: typeof saldos) => {
    const v = xs.reduce((a, s) => a.plus(s.saldoVolume), zero());
    const r = xs.reduce((a, s) => a.plus(s.saldoValor), zero());
    return { volume: v, valor: r, precoMedio: v.isZero() ? zero() : r.div(v) };
  };
  return {
    ESTRUTURA: media(saldos.filter((s) => s.linha === "ESTRUTURA")),
    ALVEOLARES: media(saldos.filter((s) => s.linha === "ALVEOLARES")),
    ESTACAS: media(saldos.filter((s) => s.linha === "ESTACAS")),
    GERAL: media(saldos),
  };
}
