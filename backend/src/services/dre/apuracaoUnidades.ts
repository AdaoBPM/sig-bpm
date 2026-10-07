import { Prisma } from "../../generated/prisma/client.js";
import { avaliarExpressao, codigosDaExpressao } from "./expressao.js";
import type { CodigoTotais } from "../volumes/totaisOperacao.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Apuração da DRE por unidade — as abas Resultados (Matriz), (Filial),
 * (Serviços), (Desp.+Extra) e (RN) do SIG BPM 2026 - BASE REALIZADO
 * (RESULTADOS). Cada linha de item sai dos lançamentos classificados (a aba
 * Gastos (Contábil)), dos percentuais de rateio, da receita prévia e dos
 * lançamentos manuais, com a regra da fórmula da planilha; subtotais e totais
 * saem das expressões da estrutura da DRE, avaliadas com os itens da unidade.
 *
 * O cálculo é puro: recebe os dados já lidos e devolve os valores com a
 * composição de cada um, para a memória de cálculo e o detalhamento.
 */

export const UNIDADE = { MATRIZ: 1, FILIAL: 2, SERVICOS: 3, DESPESAS: 4, RN: 5 } as const;

export type LinhaEstrutura = {
  id: string;
  codigo: string;
  tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL";
  grupo: string;
  grupoSigla: string;
  atribuicao: string | null;
  descricao: string;
  expressao: string | null;
  unidades: number[];
};

export type LancamentoClassificado = {
  filial: number;
  linhaDREId: string | null;
  balde: string | null;
  alocacao: string | null;
  valor: Decimal;
};

export type LancamentoManualApuracao = { linhaDREId: string | null; balde: string | null; valor: Decimal };

export type ReceitaPreviaApuracao = { unidade: number; natureza: string; receitaBruta: Decimal; receitaLiquida: Decimal };

export type DadosApuracao = {
  linhas: LinhaEstrutura[];
  lancamentos: LancamentoClassificado[];
  manuais: LancamentoManualApuracao[];
  /** Percentual por chave e destino (ex.: "PRODUCAO|MATRIZ"). */
  percentuais: Map<string, Decimal>;
  /** Volumes da aba Totais, pelo código da linha (ex.: PREFABRICADO_MATRIZ). */
  totais: Map<string, Decimal>;
  receitas: ReceitaPreviaApuracao[];
};

/** Um balde de lançamentos diretos, de uma filial ou de todas. */
export type ParBalde = { balde: string; filial?: number };
export type ParcelaRateio = { chave: string; destino: string; base: string; percentual: string; valor: string; linhaId?: string };
export type ParcelaUnidade = { unidade: number; nome: string; valor: string };
/**
 * De onde o valor saiu, na forma de filtros sobre os dados da competência —
 * é o que o detalhamento usa para chegar aos lançamentos de origem (Passo 20).
 * - contabil: lançamentos contábeis que não são de rateio, da linha, com os
 *   filtros de filial e balde da regra, multiplicados pelo fator. Em pares, a
 *   soma de baldes, cada um de uma filial ou de todas (Matriz e Filial).
 * - rateios: lançamentos de rateio da chave (o balde) na linha de base, ×
 *   percentual (estão em ParcelaRateio, com linhaId).
 * - manual: lançamentos manuais da linha e do balde.
 * - previa: a receita prévia da unidade e da natureza, com o sinal.
 */
export type OrigemValor = {
  contabil?: { linhaId: string; filial?: number; baldes?: string[]; excetoBaldes?: string[]; pares?: ParBalde[]; fator?: string };
  manual?: { linhaId: string; balde: string };
  previa?: Array<{ unidade: number; natureza: string; componente: "BRUTA" | "LIQUIDA"; sinal: 1 | -1 }>;
};
export type Composicao = {
  regra: string;
  direto?: string;
  rateios?: ParcelaRateio[];
  unidades?: ParcelaUnidade[];
  observacao?: string;
  origem?: OrigemValor;
};
export type ResultadoLinha = { unidade: number; linhaId: string; codigo: string; valor: Decimal; composicao: Composicao | null };

const zero = () => new Decimal(0);
const n = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/**
 * As linhas de volume (P e S) de cada unidade, pela descrição em maiúsculas, e
 * as linhas da aba Totais que as somam. Também usado pelo extrato das listas
 * de uma linha de volume da DRE.
 */
export const VOLUMES_DA_DRE: Record<number, Record<string, CodigoTotais[]>> = {
  1: { "PRODUÇÃO DO PRÉ-FABRICADO (M³)": ["PREFABRICADO_MATRIZ"], "PRODUÇÃO DA METALURGIA (KG)": ["METALURGIA_MATRIZ"], "EXPEDIÇÃO DO PRÉ-FABRICADO (M³)": ["EXPEDICAO_MATRIZ"] },
  2: {
    "PRODUÇÃO DO PRÉ-FABRICADO (M³)": ["PREFABRICADO_FILIAL"],
    "PRODUÇÃO DO PRÉ-FABRICADO (PISTAS)": ["PREFABRICADO_PISTAS"],
    "PRODUÇÃO DA METALURGIA (KG)": ["METALURGIA_FILIAL"],
    "EXPEDIÇÃO DO PRÉ-FABRICADO (M³)": ["EXPEDICAO_FILIAL"],
  },
  3: {
    "PRODUÇÃO DA METALURGIA (KG)": ["METALURGIA_MONTAGEM", "METALURGIA_COMPLEMENTAR"],
    "MONTAGEM DO PRÉ-FABRICADO (M³)": ["MONTAGEM"],
    "ACOMPANHAMENTO DE OBRA (D)": ["ACOMPANHAMENTO_MONTAGEM", "ACOMPANHAMENTO_COMPLEMENTAR"],
  },
};

/** Chaves de rateio que cada unidade de produção recebe, e o destino dela. */
const RATEIOS_PRODUCAO = ["PROJETO", "PRODUCAO", "METALURGIA", "ARMADURA"] as const;
const DESTINO_DA_UNIDADE: Record<number, string> = { 1: "MATRIZ", 2: "FILIAL" };

export function apurarUnidades(d: DadosApuracao): { resultados: ResultadoLinha[]; avisos: string[] } {
  const avisos: string[] = [];
  const porTripla = new Map(d.linhas.filter((l) => l.tipo === "ITEM").map((l) => [`${n(l.grupo)}|${n(l.atribuicao)}|${n(l.descricao)}`, l]));
  const porCodigo = new Map(d.linhas.map((l) => [l.codigo, l]));
  const linhaCP = (l: LinhaEstrutura) => porTripla.get(`${n("CUSTOS DE PRODUÇÃO (CP)")}|${n(l.atribuicao)}|${n(l.descricao)}`);
  const linhaCSM = (l: LinhaEstrutura) => porTripla.get(`${n("CUSTOS DE SERVIÇOS: MONTAGEM (CSM)")}|${n(l.atribuicao)}|${n(l.descricao)}`);

  // Somas dos lançamentos, na forma dos SOMASES da Gastos (Contábil): os
  // diretos por filial, linha e balde; os de rateio por chave e linha.
  const direto = new Map<string, Decimal>();
  const rateio = new Map<string, Decimal>();
  const somar = (m: Map<string, Decimal>, k: string, v: Decimal) => m.set(k, (m.get(k) ?? zero()).plus(v));
  for (const l of d.lancamentos) {
    if (!l.linhaDREId) continue;
    if (l.alocacao === "RATEIO") somar(rateio, `${l.balde}|${l.linhaDREId}`, l.valor);
    else somar(direto, `${l.filial}|${l.linhaDREId}|${l.balde}`, l.valor);
  }
  const somaDireto = (linhaId: string | undefined, filtro: { filial?: number; balde?: (b: string) => boolean } = {}) => {
    if (!linhaId) return zero();
    let s = zero();
    for (const [k, v] of direto) {
      const [f, id, b] = k.split("|");
      if (id !== linhaId) continue;
      if (filtro.filial !== undefined && Number(f) !== filtro.filial) continue;
      if (filtro.balde && !filtro.balde(b)) continue;
      s = s.plus(v);
    }
    return s;
  };
  const somaPares = (linhaId: string | undefined, pares: ParBalde[]) => {
    if (!linhaId) return zero();
    let s = zero();
    for (const [k, v] of direto) {
      const [f, id, b] = k.split("|");
      if (id === linhaId && pares.some((p) => p.balde === b && (p.filial === undefined || p.filial === Number(f)))) s = s.plus(v);
    }
    return s;
  };
  const descreverPares = (pares: ParBalde[]) =>
    pares.map((p) => (p.filial === undefined ? `balde ${p.balde}` : `balde ${p.balde} da filial ${p.filial}`)).join(" + ");
  const somaRateio = (chave: string, linhaId: string | undefined) => (linhaId ? (rateio.get(`${chave}|${linhaId}`) ?? zero()) : zero());
  const pct = (chave: string, destino: string) => d.percentuais.get(`${chave}|${destino}`) ?? zero();
  const total = (codigo: string) => d.totais.get(codigo) ?? zero();
  const previa = (unidade: number, natureza: string) =>
    d.receitas.find((r) => r.unidade === unidade && r.natureza === natureza) ?? { receitaBruta: zero(), receitaLiquida: zero() };
  const manualRN = (linhaId: string) =>
    d.manuais.filter((m) => m.linhaDREId === linhaId && n(m.balde) === "RN").reduce((a, m) => a.plus(m.valor), zero());

  const parcela = (chave: string, destino: string, linhaBase: LinhaEstrutura | undefined, base: Decimal, p: Decimal): ParcelaRateio => ({
    chave,
    destino,
    base: `${linhaBase?.codigo ?? "?"}: ${base.toFixed(2)}`,
    percentual: p.toFixed(10),
    valor: base.times(p).toFixed(2),
    linhaId: linhaBase?.id,
  });

  // Valores por unidade, linha → valor.
  const valores = new Map<number, Map<string, Decimal>>();
  const composicoes = new Map<string, Composicao>();
  const gravar = (u: number, l: LinhaEstrutura, v: Decimal, c: Composicao | null) => {
    if (!valores.has(u)) valores.set(u, new Map());
    valores.get(u)!.set(l.codigo, v);
    if (c) composicoes.set(`${u}|${l.codigo}`, c);
  };
  const valorDe = (u: number, codigo: string) => valores.get(u)?.get(codigo) ?? zero();
  const itemDe = (u: number, descricao: string) => {
    const l = d.linhas.find((x) => x.tipo === "ITEM" && n(x.descricao) === n(descricao) && x.unidades.includes(u));
    return l ? valorDe(u, l.codigo) : zero();
  };

  // --- Volumes (linhas P e S), da aba Totais -------------------------------
  const VOLUMES = VOLUMES_DA_DRE;

  // Guardas das fórmulas: IF(B$4=0,0,…) e, em Serviços, IF(B$6=0,0,…) — a montagem
  // do mês — nos custos, na receita de montagem, nos impostos e nas comissões
  // (correção do usuário de 29/09/2026 na aba Realizado (Serviços)).
  const guarda: Record<number, Decimal> = {
    1: total("PREFABRICADO_MATRIZ"),
    2: total("PREFABRICADO_FILIAL"),
    3: total("METALURGIA_MONTAGEM").plus(total("METALURGIA_COMPLEMENTAR")),
  };
  const guardaCustosServicos = total("MONTAGEM");

  const itensDa = (u: number) => d.linhas.filter((l) => l.tipo === "ITEM" && l.unidades.includes(u));
  const ehVolume = (l: LinhaEstrutura) => l.grupoSigla === "P" || l.grupoSigla === "S";
  const ehComissao = (l: LinhaEstrutura) => n(l.descricao) === n("Comissões de Representantes e Terceiros");
  const linhaPorDescricao = (u: number, descricao: string) =>
    d.linhas.find((x) => n(x.descricao) === n(descricao) && x.unidades.includes(u) && (x.tipo === "ITEM" || x.tipo === "TOTAL"));

  // --- Matriz e Filial -----------------------------------------------------
  // Os diretos da unidade são o balde dela (MATRIZ ou FILIAL), de qualquer
  // filial, e o balde UNIDADE da filial dela; nas receitas e nos impostos,
  // também o balde DESPESAS da filial (abas Resultados (Matriz) e (Filial),
  // a partir de 06/10/2026).
  for (const u of [UNIDADE.MATRIZ, UNIDADE.FILIAL]) {
    const destino = DESTINO_DA_UNIDADE[u];
    const semProducao = guarda[u].isZero();
    const receitaFrete = previa(u, "FRETE");
    const paresCusto: ParBalde[] = [{ balde: destino }, { balde: "UNIDADE", filial: u }];
    const paresReceita: ParBalde[] = [...paresCusto, { balde: "DESPESAS", filial: u }];
    for (const l of itensDa(u)) {
      if (ehVolume(l)) {
        const cods = VOLUMES[u][n(l.descricao)] ?? [];
        gravar(u, l, cods.reduce((a, c) => a.plus(total(c)), zero()), { regra: `Volume da aba Totais: ${cods.join(" + ") || "—"}` });
        continue;
      }
      if (ehComissao(l)) continue; // depois da ROB consolidada
      const desc = n(l.descricao);
      if (semProducao) {
        gravar(u, l, zero(), { regra: "Sem produção de pré-fabricado na unidade: zero (IF(B$4=0,0,…))" });
        continue;
      }
      if (desc === n("Receita Bruta do Pré-Fabricado")) {
        const contabil = somaPares(l.id, paresReceita);
        gravar(u, l, receitaFrete.receitaBruta.neg().minus(contabil), {
          regra: `−(frete da receita prévia) − (receita contábil: ${descreverPares(paresReceita)})`,
          direto: contabil.toFixed(2),
          observacao: `Frete da receita prévia: ${receitaFrete.receitaBruta.toFixed(2)}`,
          origem: { contabil: { linhaId: l.id, pares: paresReceita, fator: "-1" }, previa: [{ unidade: u, natureza: "FRETE", componente: "BRUTA", sinal: -1 }] },
        });
      } else if (desc === n("Receita Bruta de Frete")) {
        gravar(u, l, receitaFrete.receitaBruta, {
          regra: "Receita bruta de frete da receita prévia",
          origem: { previa: [{ unidade: u, natureza: "FRETE", componente: "BRUTA", sinal: 1 }] },
        });
      } else if (desc === n("Receita Bruta de Devoluções e Inventários")) {
        // Negativa, como a receita bruta do pré-fabricado (correção do usuário de 06/10/2026).
        const c = somaPares(l.id, paresReceita);
        gravar(u, l, c.neg(), {
          regra: `−(lançamentos contábeis: ${descreverPares(paresReceita)})`,
          direto: c.toFixed(2),
          origem: { contabil: { linhaId: l.id, pares: paresReceita, fator: "-1" } },
        });
      } else if (desc === n("Receita Líquida de Frete")) {
        gravar(u, l, receitaFrete.receitaLiquida, {
          regra: "Receita líquida de frete da receita prévia",
          origem: { previa: [{ unidade: u, natureza: "FRETE", componente: "LIQUIDA", sinal: 1 }] },
        });
      } else if (desc === n("Receita Líquida do Pré-Fabricado") || desc === n("Receita Líquida de Devoluções e Inventários")) {
        continue; // depois dos impostos
      } else {
        const dir = somaPares(l.id, paresCusto);
        let v = dir;
        const rateios: ParcelaRateio[] = [];
        for (const chave of RATEIOS_PRODUCAO) {
          const base = somaRateio(chave, l.id);
          if (base.isZero()) continue;
          const p = pct(chave, destino);
          rateios.push(parcela(chave, destino, l, base, p));
          v = v.plus(base.times(p));
        }
        gravar(u, l, v, {
          regra: `Diretos (${descreverPares(paresCusto)}) + rateios × percentual da unidade`,
          direto: dir.toFixed(2),
          rateios,
          origem: { contabil: { linhaId: l.id, pares: paresCusto } },
        });
      }
    }
    // Impostos Operacionais: no Consolidado é ROB − ROL; na unidade, o contábil
    // dos baldes da receita.
    const io = linhaPorDescricao(u, "Impostos Operacionais");
    if (io) {
      const v = semProducao ? zero() : somaPares(io.id, paresReceita);
      gravar(u, io, v, {
        regra: `Lançamentos contábeis: ${descreverPares(paresReceita)}`,
        direto: v.toFixed(2),
        origem: semProducao ? undefined : { contabil: { linhaId: io.id, pares: paresReceita } },
      });
    }
    // Receitas líquidas do pré-fabricado e das devoluções: a bruta menos a
    // parte dos impostos (sem os do frete), na proporção da bruta.
    const robPre = itemDe(u, "Receita Bruta do Pré-Fabricado");
    const robDev = itemDe(u, "Receita Bruta de Devoluções e Inventários");
    const irb = io ? valorDe(u, io.codigo) : zero();
    const impostosFrete = receitaFrete.receitaBruta.minus(receitaFrete.receitaLiquida);
    const base = robPre.plus(robDev);
    const fator = base.isZero() ? zero() : irb.minus(impostosFrete).div(base);
    if (!semProducao && base.isZero() && !irb.minus(impostosFrete).isZero()) {
      avisos.push(`Unidade ${u}: receita bruta de pré-fabricado + devoluções é zero; a planilha dá #DIV/0! nas receitas líquidas.`);
    }
    for (const [descricao, rob] of [["Receita Líquida do Pré-Fabricado", robPre], ["Receita Líquida de Devoluções e Inventários", robDev]] as const) {
      const l = linhaPorDescricao(u, descricao);
      if (!l) continue;
      gravar(u, l, semProducao ? zero() : rob.minus(fator.times(rob)), {
        regra: "Bruta − (IRB − impostos do frete) / (bruta do pré-fabricado + devoluções) × bruta",
        observacao: `Bruta ${rob.toFixed(2)} − (IRB ${irb.toFixed(2)} − impostos do frete ${impostosFrete.toFixed(2)}) / ${base.toFixed(2)} × bruta; fator ${fator.toFixed(10)}`,
      });
    }
  }

  // --- Serviços -------------------------------------------------------------
  {
    const u = UNIDADE.SERVICOS;
    const semMontagem = guardaCustosServicos.isZero();
    const compl = previa(u, "COMPLEMENTAR");
    for (const l of itensDa(u)) {
      const desc = n(l.descricao);
      if (ehVolume(l)) {
        const cods = VOLUMES[u][desc] ?? [];
        gravar(u, l, cods.reduce((a, c) => a.plus(total(c)), zero()), { regra: `Volume da aba Totais: ${cods.join(" + ") || "—"}` });
        continue;
      }
      if (ehComissao(l)) continue;
      if (desc === n("Receita Bruta de Montagem")) {
        const c = somaDireto(l.id);
        gravar(u, l, semMontagem ? zero() : compl.receitaBruta.neg().minus(c), {
          regra: "−(complementar da receita prévia) − (receita contábil, todas as filiais)",
          direto: c.toFixed(2),
          origem: semMontagem
            ? undefined
            : { contabil: { linhaId: l.id, fator: "-1" }, previa: [{ unidade: u, natureza: "COMPLEMENTAR", componente: "BRUTA", sinal: -1 }] },
        });
      } else if (desc === n("Receita Bruta Complementar")) {
        gravar(u, l, compl.receitaBruta, {
          regra: "Receita bruta complementar da receita prévia",
          origem: { previa: [{ unidade: u, natureza: "COMPLEMENTAR", componente: "BRUTA", sinal: 1 }] },
        });
      } else if (desc === n("Receita Líquida Complementar")) {
        gravar(u, l, compl.receitaLiquida, {
          regra: "Receita líquida complementar da receita prévia",
          origem: { previa: [{ unidade: u, natureza: "COMPLEMENTAR", componente: "LIQUIDA", sinal: 1 }] },
        });
      } else if (desc === n("Receita Líquida de Montagem")) {
        continue; // depois dos impostos
      } else if (l.grupoSigla === "CSM" || l.grupoSigla === "CSC") {
        if (semMontagem) {
          gravar(u, l, zero(), { regra: "Sem montagem no mês: zero (IF(B$6=0,0,…))" });
          continue;
        }
        const montagem = l.grupoSigla === "CSM";
        const destino = montagem ? "MONTAGEM" : "COMPLEMENTAR";
        const dir = somaDireto(l.id, { balde: (b) => b === (montagem ? "OBRAS" : "COMPLEMENTAR") });
        let v = dir;
        const rateios: ParcelaRateio[] = [];
        const partes: Array<[string, LinhaEstrutura | undefined]> = [
          ["ACOMPANHAMENTO", montagem ? l : linhaCSM(l)],
          ["METALURGIA", linhaCP(l)],
          ["ARMADURA", linhaCP(l)],
        ];
        // A depreciação de montagem fica com o acompanhamento inteiro: o bloco
        // complementar não tem linha de depreciação (aba Resultados (Serviços),
        // linha 68, correção do usuário de 06/10/2026).
        const acompanhamentoInteiro = montagem && n(l.descricao) === n("Depreciação do Maquinário");
        for (const [chave, linhaBase] of partes) {
          const baseV = somaRateio(chave, linhaBase?.id);
          if (baseV.isZero()) continue;
          const p = chave === "ACOMPANHAMENTO" && acompanhamentoInteiro ? zero().plus(1) : pct(chave, destino);
          rateios.push(parcela(chave, destino, linhaBase, baseV, p));
          v = v.plus(baseV.times(p));
        }
        gravar(u, l, v, {
          regra: `Diretos do balde ${montagem ? "OBRAS" : "COMPLEMENTAR"} + rateios × percentual de ${destino.toLowerCase()}`,
          direto: dir.toFixed(2),
          rateios,
          origem: { contabil: { linhaId: l.id, baldes: [montagem ? "OBRAS" : "COMPLEMENTAR"] } },
        });
      } else {
        gravar(u, l, zero(), { regra: "Linha sem regra na unidade" });
        avisos.push(`Serviços: a linha ${l.codigo} não tem regra de apuração.`);
      }
    }
    const io = linhaPorDescricao(u, "Impostos Operacionais");
    if (io) {
      const v = semMontagem ? zero() : somaDireto(io.id, { balde: (b) => b === "OBRAS" });
      gravar(u, io, v, {
        regra: "Lançamentos contábeis do balde OBRAS, todas as filiais",
        direto: v.toFixed(2),
        origem: semMontagem ? undefined : { contabil: { linhaId: io.id, baldes: ["OBRAS"] } },
      });
      const rlm = linhaPorDescricao(u, "Receita Líquida de Montagem");
      if (rlm) {
        const rbm = itemDe(u, "Receita Bruta de Montagem");
        gravar(u, rlm, semMontagem ? zero() : rbm.minus(v.minus(compl.receitaBruta.minus(compl.receitaLiquida))), {
          regra: "Bruta de montagem − (IRB − impostos da complementar)",
          observacao: `Bruta de montagem ${rbm.toFixed(2)} − (IRB ${v.toFixed(2)} − impostos da complementar ${compl.receitaBruta.minus(compl.receitaLiquida).toFixed(2)})`,
        });
      }
    }
  }

  // --- Despesas + Extra ----------------------------------------------------
  // Guarda: a ROL consolidada (Resultados (Desp.+Extra), linha 2).
  const rolDe = (u: number) => {
    const l = porCodigo.get("ROL.RECEITA_OPERACIONAL_LIQUIDA_ROL");
    return l?.expressao ? avaliarExpressao(l.expressao, (c) => valorDe(u, c)) : zero();
  };
  const robDe = (u: number) => {
    const l = porCodigo.get("ROB.RECEITA_OPERACIONAL_BRUTA_ROB");
    return l?.expressao ? avaliarExpressao(l.expressao, (c) => valorDe(u, c)) : zero();
  };
  const rolConsolidada = [1, 2, 3].reduce((a, u) => a.plus(rolDe(u)), zero());
  const robConsolidada = [1, 2, 3].reduce((a, u) => a.plus(robDe(u)), zero());
  {
    const u = UNIDADE.DESPESAS;
    for (const l of itensDa(u)) {
      if (rolConsolidada.isZero()) {
        gravar(u, l, zero(), { regra: "ROL consolidada zero: zero" });
        continue;
      }
      const c = somaDireto(l.id);
      // Receitas financeiras entram com o sinal trocado (linhas 84, 85 e 87).
      const financeira = l.grupoSigla === "RFC" || l.grupoSigla === "RFNC";
      // As receitas e despesas financeiras somam também o rateio de
      // acompanhamento inteiro (linhas 84, 85, 87, 91 a 93 e 95, correções do
      // usuário de 06/10/2026): é o centro ADM. DE OBRAS que transforma em
      // rateio os juros e descontos lançados nele.
      const despesaFinanceira = l.grupoSigla === "DFC" || l.grupoSigla === "DFNC";
      const acompanhamento = despesaFinanceira || financeira ? somaRateio("ACOMPANHAMENTO", l.id) : zero();
      const rateios = acompanhamento.isZero() ? [] : [parcela("ACOMPANHAMENTO", "DESPESAS", l, acompanhamento, zero().plus(financeira ? -1 : 1))];
      gravar(u, l, financeira ? c.plus(acompanhamento).neg() : c.plus(acompanhamento), {
        regra: financeira
          ? "−(lançamentos contábeis diretos + rateio de acompanhamento inteiro)"
          : despesaFinanceira
            ? "Lançamentos contábeis diretos + rateio de acompanhamento inteiro"
            : "Lançamentos contábeis diretos",
        direto: c.toFixed(2),
        ...(rateios.length ? { rateios } : {}),
        origem: { contabil: { linhaId: l.id, ...(financeira ? { fator: "-1" } : {}) } },
      });
    }
  }

  // --- RN: lançamentos manuais do balde RN ----------------------------------
  for (const l of itensDa(UNIDADE.RN)) {
    const v = manualRN(l.id);
    gravar(UNIDADE.RN, l, v, { regra: "Lançamentos manuais do balde RN", origem: { manual: { linhaId: l.id, balde: "RN" } } });
  }

  // --- Comissões: diretos × participação da unidade na ROB consolidada ------
  for (const u of [UNIDADE.MATRIZ, UNIDADE.FILIAL, UNIDADE.SERVICOS]) {
    for (const l of itensDa(u).filter(ehComissao)) {
      const c = somaDireto(l.id);
      const rob = robDe(u);
      const semBase = u === UNIDADE.SERVICOS ? guardaCustosServicos.isZero() : guarda[u].isZero();
      const v = semBase || robConsolidada.isZero() ? zero() : c.div(robConsolidada).times(rob);
      const fator = semBase || robConsolidada.isZero() ? null : rob.div(robConsolidada);
      gravar(u, l, v, {
        regra: "Diretos da linha / ROB consolidada × ROB da unidade",
        direto: c.toFixed(2),
        observacao: `ROB ${rob.toFixed(2)} de ${robConsolidada.toFixed(2)}`,
        origem: fator ? { contabil: { linhaId: l.id, fator: fator.toString() } } : undefined,
      });
    }
  }

  // --- Subtotais e totais, pela estrutura, com os itens da unidade ---------
  const ordenadas = [...d.linhas].filter((l) => l.tipo !== "ITEM" && l.tipo !== "SECAO" && l.expressao);
  for (const u of [1, 2, 3, 4, 5]) {
    const avaliar = (codigo: string, pilha = new Set<string>()): Decimal => {
      const jaTem = valores.get(u)?.get(codigo);
      if (jaTem !== undefined) return jaTem;
      const l = porCodigo.get(codigo);
      if (!l || l.tipo === "ITEM" || !l.expressao) return zero();
      if (pilha.has(codigo)) throw new Error(`Referência circular na estrutura da DRE: ${codigo}`);
      pilha.add(codigo);
      const v = avaliarExpressao(l.expressao, (c) => avaliar(c, pilha));
      gravar(u, l, v, null);
      return v;
    };
    for (const l of ordenadas) avaliar(l.codigo);
  }

  // Linhas da unidade: as que a estrutura atribui a ela e os totais gerais
  // (margens) cujas parcelas são todas da unidade — a margem bruta e a de
  // contribuição entram na Matriz; o EBITDA, que usa as despesas fixas, não.
  const daUnidade = (u: number) => {
    const s = new Set(d.linhas.filter((l) => l.unidades.includes(u)).map((l) => l.codigo));
    for (let mudou = true; mudou; ) {
      mudou = false;
      for (const l of d.linhas) {
        if (s.has(l.codigo) || l.unidades.length > 0 || !l.expressao) continue;
        if (codigosDaExpressao(l.expressao).every((c) => s.has(c))) {
          s.add(l.codigo);
          mudou = true;
        }
      }
    }
    return s;
  };
  const resultados: ResultadoLinha[] = [];
  for (const [u, m] of valores) {
    const relevantes = daUnidade(u);
    for (const [codigo, valor] of m) {
      if (!relevantes.has(codigo)) continue;
      const l = porCodigo.get(codigo)!;
      resultados.push({ unidade: u, linhaId: l.id, codigo, valor, composicao: composicoes.get(`${u}|${codigo}`) ?? null });
    }
  }
  return { resultados, avisos };
}
