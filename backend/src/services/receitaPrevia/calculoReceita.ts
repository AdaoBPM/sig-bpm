import { Prisma } from "../../generated/prisma/client.js";
import type { ComponenteReceita, CriterioReceita, NaturezaReceita, OrigemReceita, TipoVenda } from "../../generated/prisma/enums.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Cálculo da receita prévia, item a item, com as regras das abas de receita do
 * SIG BPM 2026 - BASE PRÉVIAS (RECEITAS E ESTOQUE):
 *
 *  - Receita (Produção): pré-fabricado pelo volume produzido × preço da DRE do
 *    Comercial (versão 0); sem contrato, obra genérica ou linha incoerente com
 *    a unidade, preço padrão (3.500 ou, para alveolares, 2.000 por m³ de
 *    receita líquida; a bruta é a líquida / 0,93). Estaca não gera receita na
 *    produção: entra no estoque pela tabela de estacas;
 *  - Receita (Expedição): frete pelo volume expedido × preço de frete; a
 *    estaca vira receita na expedição (preço do contrato, ou o da tabela se
 *    não houver contrato) e sai do estoque pela tabela;
 *  - Receita (Saídas) e Receita (Devoluções): valor da nota menos os créditos;
 *    a devolução só conta se o movimento está nos Tipos de Movimento;
 *  - Receita (Serviços): diferença de execução × Fat. BPM, e a líquida pela
 *    proporção IRB/ROB da linha MONTAGEM da DRE da obra.
 *
 * E o destino de cada parcela na aba Receitas (Prévia): unidade e natureza.
 * O cálculo é puro — recebe os dados já lidos — para poder ser testado e para
 * que a memória de cálculo saia dele sem reconstrução.
 */

export const UNIDADE = { MATRIZ: 1, FILIAL: 2, OBRAS: 3 } as const;
type CodigoUnidade = (typeof UNIDADE)[keyof typeof UNIDADE];

export const OBRAS_GENERICAS = new Set(["G11", "M2", "M3", "M9999"]);

/** Preço padrão de receita líquida por m³, para quem não tem preço de contrato. */
const PRECO_PADRAO_LIQUIDO = { ALVEOLARES: 2000, OUTRAS: 3500 };
const FATOR_BRUTO = 0.93;

export type PrecoVigente = {
  id: string;
  obra: string;
  versao: number;
  linha: string;
  atribuicao: string | null;
  departamento: string | null;
  valorUnitario: Decimal | null;
  valorTotal: Decimal | null;
};

export type EstacaTabela = { grupo: string; secao: string; peca: string; precoLiquido: Decimal };

export type Registro = {
  id: string;
  obra: string | null;
  unidade: number | null;
  linha: string | null;
  quantidade: Decimal;
  nomePeca?: string | null;
  secao?: string | null;
  valor?: Decimal | null;
  creditos?: Decimal | null;
  movimento?: string | null;
  valorMedido?: Decimal | null;
  tipoFaturamento?: string | null;
};

export type LancamentoReceitaCalculo = {
  id: string;
  unidade: number;
  natureza: NaturezaReceita;
  componente: ComponenteReceita;
  valor: Decimal;
  observacao: string;
  venda: TipoVenda | null;
};

export type ItemReceita = {
  unidade: CodigoUnidade;
  natureza: NaturezaReceita;
  origem: OrigemReceita;
  registroId: string | null;
  obraCodigo: string | null;
  linha: string | null;
  quantidade: Decimal | null;
  criterio: CriterioReceita;
  precoBruto: Decimal | null;
  precoLiquido: Decimal | null;
  precoBrutoId: string | null;
  precoLiquidoId: string | null;
  receitaBruta: Decimal;
  receitaLiquida: Decimal;
  variacaoEstoque: Decimal;
  observacao: string | null;
  /** Global ou mercantil; nulo nas medições de Obras. */
  venda: TipoVenda | null;
  /** Peça da estaca, movimento ou tipo de faturamento: o que separa as linhas da obra nas abas de receita. */
  detalhe: string | null;
};

export type DadosCalculo = {
  precos: PrecoVigente[];
  estacas: EstacaTabela[];
  /** Códigos dos Tipos de Movimento ativos. */
  movimentos: Set<string>;
  producoes: Registro[];
  expedicoes: Registro[];
  saidas: Registro[];
  devolucoes: Registro[];
  medicoes: Registro[];
  lancamentos: LancamentoReceitaCalculo[];
};

const zero = () => new Decimal(0);
const norm = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();

/** Índice dos preços vigentes, na forma dos SOMASES da planilha. */
export function indexarPrecos(precos: PrecoVigente[]) {
  const obrasComDRE = new Set(precos.map((p) => norm(p.obra)));
  const porAtribuicao = new Map<string, PrecoVigente[]>();
  const porDepartamento = new Map<string, PrecoVigente[]>();
  for (const p of precos) {
    if (p.versao !== 0) continue;
    const ka = `${norm(p.obra)}|${norm(p.linha)}|${norm(p.atribuicao)}`;
    porAtribuicao.set(ka, [...(porAtribuicao.get(ka) ?? []), p]);
    const kd = `${norm(p.obra)}|${norm(p.linha)}|${norm(p.departamento)}`;
    porDepartamento.set(kd, [...(porDepartamento.get(kd) ?? []), p]);
  }
  return {
    /** COUNTIFS da obra na DRE: a obra tem DRE (em qualquer versão)? */
    temDRE: (obra: string | null) => obrasComDRE.has(norm(obra)),
    /** SOMASES do V. UNIT. por obra, linha e atribuição, na versão 0. */
    unitario(obra: string | null, linha: string | null, atribuicao: string) {
      const ps = porAtribuicao.get(`${norm(obra)}|${norm(linha)}|${norm(atribuicao)}`) ?? [];
      return { valor: ps.reduce((a, p) => a.plus(p.valorUnitario ?? 0), zero()), id: ps[0]?.id ?? null };
    },
    /** SOMASES do V. TOTAL por obra, linha e departamento (sigla), na versão 0. */
    total(obra: string | null, linha: string, departamento: string) {
      const ps = porDepartamento.get(`${norm(obra)}|${norm(linha)}|${norm(departamento)}`) ?? [];
      return ps.reduce((a, p) => a.plus(p.valorTotal ?? 0), zero());
    },
  };
}

/** Grupo da estaca pelo nome da peça — a coluna Grupo da Produção (Resumo). */
export function grupoDaEstaca(peca: string | null | undefined) {
  const p = norm(peca);
  if (p.startsWith("ESD")) return "ESD";
  if (p.startsWith("ES")) return "ES";
  return "E";
}

/** Código da peça de estaca na expedição — a coluna Peça da Expedição (Lista). */
export function pecaDaEstaca(peca: string | null | undefined) {
  const p = norm(peca);
  if (p.startsWith("ESD")) return p.slice(0, 5);
  if (p.startsWith("ES")) return p.slice(0, 4);
  return p.slice(0, 3);
}

/**
 * A coluna Venda das abas de receita: "G" quando o código da obra começa com
 * G, "M" nos demais — inclusive sem obra, como a sucata vendida sem projeto
 * na aba Receita (Saídas). Obras não se separam.
 */
export const vendaDaObra = (obra: string | null | undefined): TipoVenda => (obra?.toUpperCase().startsWith("G") ? "GLOBAL" : "MERCANTIL");

function base(r: Registro, unidade: CodigoUnidade, natureza: NaturezaReceita, origem: OrigemReceita): ItemReceita {
  return {
    unidade,
    natureza,
    origem,
    registroId: r.id,
    obraCodigo: r.obra,
    linha: r.linha,
    quantidade: r.quantidade,
    criterio: "CONTRATO",
    precoBruto: null,
    precoLiquido: null,
    precoBrutoId: null,
    precoLiquidoId: null,
    receitaBruta: zero(),
    receitaLiquida: zero(),
    variacaoEstoque: zero(),
    observacao: null,
    venda: unidade === UNIDADE.OBRAS ? null : vendaDaObra(r.obra),
    detalhe: null,
  };
}

const unidadeDe = (u: number | null): CodigoUnidade => (u === 1 ? 1 : u === 3 ? 3 : 2);

export function calcularReceita(d: DadosCalculo): { itens: ItemReceita[]; avisos: string[] } {
  const precos = indexarPrecos(d.precos);
  const estacaPorGrupoSecao = new Map(d.estacas.map((e) => [`${norm(e.grupo)}|${norm(e.secao)}`, e.precoLiquido]));
  const estacaPorPeca = new Map(d.estacas.map((e) => [norm(e.peca), e.precoLiquido]));
  const itens: ItemReceita[] = [];
  const avisos: string[] = [];
  const semTabela = new Set<string>();
  const semMontagem = new Set<string>();

  // Receita (Produção) ------------------------------------------------------
  for (const r of d.producoes) {
    const linha = norm(r.linha);
    const u = unidadeDe(r.unidade);
    // A variação do estoque de estacas vai para a Filial, qualquer que seja a
    // unidade da lista (Receitas (Prévia), linha Variação do Estoque).
    const item = base(r, linha === "ESTACAS" ? UNIDADE.FILIAL : u, "PRE_FABRICADO", "PRODUCAO");
    if (linha === "ESTACAS") {
      // Estaca: sem receita na produção; entra no estoque pela tabela (RL PROD.).
      const preco = estacaPorGrupoSecao.get(`${grupoDaEstaca(r.nomePeca)}|${norm(r.secao)}`);
      if (!preco) semTabela.add(`${grupoDaEstaca(r.nomePeca)} ${r.secao ?? "?"}`);
      item.criterio = "TABELA_ESTACA";
      item.detalhe = `${grupoDaEstaca(r.nomePeca)} ${r.secao ?? ""}`.trim();
      item.precoLiquido = preco ?? zero();
      // Na aba Receitas (Prévia), a variação do estoque é -Σ P da produção.
      item.variacaoEstoque = (preco ?? zero()).times(r.quantidade).neg();
      itens.push(item);
      continue;
    }
    const inconsistente = (u === 1 && linha !== "ESTRUTURA") || (u !== 1 && linha === "ESTRUTURA");
    item.criterio = inconsistente
      ? "LINHA_INCONSISTENTE"
      : OBRAS_GENERICAS.has(norm(r.obra))
        ? "GENERICA"
        : !precos.temDRE(r.obra)
          ? "SEM_CONTRATO"
          : "CONTRATO";
    if (item.criterio !== "CONTRATO") {
      const liquido = new Decimal(linha === "ALVEOLARES" ? PRECO_PADRAO_LIQUIDO.ALVEOLARES : PRECO_PADRAO_LIQUIDO.OUTRAS);
      item.precoLiquido = liquido;
      item.precoBruto = liquido.div(FATOR_BRUTO);
    } else {
      const b = precos.unitario(r.obra, linha, "Receita Bruta do Pré-Fabricado");
      const l = precos.unitario(r.obra, linha, "Receita Líquida do Pré-Fabricado");
      Object.assign(item, { precoBruto: b.valor, precoBrutoId: b.id, precoLiquido: l.valor, precoLiquidoId: l.id });
    }
    item.receitaBruta = item.precoBruto!.times(r.quantidade);
    item.receitaLiquida = item.precoLiquido!.times(r.quantidade);
    itens.push(item);
  }

  // Receita (Expedição) -----------------------------------------------------
  for (const r of d.expedicoes) {
    const linha = norm(r.linha);
    const u = unidadeDe(r.unidade);
    const contrato = precos.temDRE(r.obra);
    const criterio: CriterioReceita = contrato ? "CONTRATO" : "SEM_CONTRATO";

    if (linha === "ESTACAS") {
      // P: saída do estoque pela tabela (negativa). L e N: com contrato, o
      // preço da DRE; sem contrato, o próprio valor da tabela (-P). Sem preço
      // na tabela, P é zero e a estaca não gera receita (fórmula L: P=0 → 0).
      const precoTabela = estacaPorPeca.get(pecaDaEstaca(r.nomePeca));
      if (!precoTabela) semTabela.add(pecaDaEstaca(r.nomePeca));
      const p = (precoTabela ?? zero()).times(r.quantidade).neg();
      const item = base(r, UNIDADE.FILIAL, "PRE_FABRICADO", "EXPEDICAO");
      item.criterio = contrato ? "CONTRATO" : "TABELA_ESTACA";
      item.detalhe = pecaDaEstaca(r.nomePeca);
      if (!p.isZero()) {
        if (contrato) {
          const b = precos.unitario(r.obra, linha, "Receita Bruta do Pré-Fabricado");
          const l = precos.unitario(r.obra, linha, "Receita Líquida do Pré-Fabricado");
          Object.assign(item, { precoBruto: b.valor, precoBrutoId: b.id, precoLiquido: l.valor, precoLiquidoId: l.id });
          item.receitaBruta = b.valor.times(r.quantidade);
          item.receitaLiquida = l.valor.times(r.quantidade);
        } else {
          item.precoBruto = precoTabela!;
          item.precoLiquido = precoTabela!;
          item.receitaBruta = p.neg();
          item.receitaLiquida = p.neg();
        }
      }
      // Na aba Receitas (Prévia), a variação do estoque é -Σ P da expedição.
      item.variacaoEstoque = p.neg();
      itens.push(item);
    }

    const frete = base(r, u, "FRETE", "EXPEDICAO");
    frete.criterio = criterio;
    if (linha === "ESTACAS") frete.detalhe = pecaDaEstaca(r.nomePeca);
    if (contrato) {
      const b = precos.unitario(r.obra, linha, "Receita Bruta de Frete");
      const l = precos.unitario(r.obra, linha, "Receita Líquida de Frete");
      Object.assign(frete, { precoBruto: b.valor, precoBrutoId: b.id, precoLiquido: l.valor, precoLiquidoId: l.id });
      frete.receitaBruta = b.valor.times(r.quantidade);
      frete.receitaLiquida = l.valor.times(r.quantidade);
    }
    itens.push(frete);
  }

  // Receita (Saídas) --------------------------------------------------------
  for (const r of d.saidas) {
    const linha = norm(r.linha);
    const item = base(r, linha === "METALÚRGICA" ? UNIDADE.MATRIZ : UNIDADE.FILIAL, "PRE_FABRICADO", "SAIDA");
    item.criterio = "NOTA_FISCAL";
    item.detalhe = r.movimento ?? null;
    item.receitaBruta = r.valor ?? zero();
    item.receitaLiquida = item.receitaBruta.minus(r.creditos ?? 0);
    itens.push(item);
  }

  // Receita (Devoluções) ----------------------------------------------------
  const foraDaTabela = new Set<string>();
  for (const r of d.devolucoes) {
    const linha = norm(r.linha);
    const item = base(r, linha === "ESTRUTURA" ? UNIDADE.MATRIZ : UNIDADE.FILIAL, "DEVOLUCOES_INVENTARIOS", "DEVOLUCAO");
    item.criterio = "NOTA_FISCAL";
    item.detalhe = r.movimento ?? null;
    if (d.movimentos.has(norm(r.movimento))) {
      item.receitaBruta = (r.valor ?? zero()).neg();
      item.receitaLiquida = item.receitaBruta.plus(r.creditos ?? 0);
    } else {
      foraDaTabela.add(r.movimento ?? "(sem movimento)");
      item.observacao = "Movimento fora dos Tipos de Movimento: não conta como receita.";
    }
    itens.push(item);
  }

  // Receita (Serviços) ------------------------------------------------------
  for (const r of d.medicoes) {
    const linha = norm(r.linha);
    const natureza: NaturezaReceita = linha === "MONTAGEM" || linha === "VEDAÇÃO" ? "MONTAGEM" : "COMPLEMENTAR";
    const item = base(r, UNIDADE.OBRAS, natureza, "MEDICAO");
    item.criterio = "MEDICAO";
    item.detalhe = r.tipoFaturamento ?? null;
    item.receitaBruta = r.valorMedido ?? zero();
    const rob = precos.total(r.obra, "MONTAGEM", "ROB");
    const irb = precos.total(r.obra, "MONTAGEM", "IRB");
    if (rob.isZero()) {
      // A planilha devolve "X" (IFERROR da divisão) e a soma ignora o texto:
      // a medição entra na bruta e fica fora da líquida.
      semMontagem.add(r.obra ?? "(sem obra)");
      item.observacao = "Obra sem ROB na linha MONTAGEM da DRE: receita líquida zero, como na planilha.";
    } else {
      item.receitaLiquida = item.receitaBruta.times(new Decimal(1).minus(irb.div(rob)));
    }
    itens.push(item);
  }

  // Receita (Lanç. Manuais) -------------------------------------------------
  for (const l of d.lancamentos) {
    const item: ItemReceita = {
      ...base({ id: l.id, obra: null, unidade: l.unidade, linha: null, quantidade: zero() }, unidadeDe(l.unidade), l.natureza, "LANCAMENTO"),
      quantidade: null,
      criterio: "LANCAMENTO",
      observacao: l.observacao,
      venda: unidadeDe(l.unidade) === UNIDADE.OBRAS ? null : l.venda,
    };
    if (l.componente === "BRUTA") item.receitaBruta = l.valor;
    else if (l.componente === "LIQUIDA") item.receitaLiquida = l.valor;
    else item.variacaoEstoque = l.valor;
    itens.push(item);
  }

  if (semTabela.size) avisos.push(`Estaca sem preço na tabela de estacas (valor zero): ${[...semTabela].sort().join(", ")}.`);
  if (foraDaTabela.size) avisos.push(`Devolução com movimento fora dos Tipos de Movimento (não conta): ${[...foraDaTabela].sort().join(", ")}.`);
  if (semMontagem.size) {
    avisos.push(`Medição de obra sem ROB na linha MONTAGEM da DRE (receita líquida zero): ${[...semMontagem].sort().join(", ")}.`);
  }
  return { itens, avisos };
}

export type TotalReceita = {
  unidade: CodigoUnidade;
  natureza: NaturezaReceita;
  receitaBruta: Decimal;
  receitaLiquida: Decimal;
  impostos: Decimal;
  variacaoEstoque: Decimal;
};

/** Totais por unidade e natureza: as linhas da aba Receitas (Prévia). O IRB é bruta − líquida. */
export function totalizar(itens: ItemReceita[]): TotalReceita[] {
  const m = new Map<string, TotalReceita>();
  for (const i of itens) {
    const k = `${i.unidade}|${i.natureza}`;
    const t = m.get(k) ?? { unidade: i.unidade, natureza: i.natureza, receitaBruta: zero(), receitaLiquida: zero(), impostos: zero(), variacaoEstoque: zero() };
    t.receitaBruta = t.receitaBruta.plus(i.receitaBruta);
    t.receitaLiquida = t.receitaLiquida.plus(i.receitaLiquida);
    t.variacaoEstoque = t.variacaoEstoque.plus(i.variacaoEstoque);
    t.impostos = t.receitaBruta.minus(t.receitaLiquida);
    m.set(k, t);
  }
  return [...m.values()].sort((a, b) => a.unidade - b.unidade || a.natureza.localeCompare(b.natureza));
}

/** Alíquotas de PIS/COFINS da aba Receitas (Prévia): venda global (serviço) e mercantil. */
export const PIS_COFINS = { GLOBAL: new Decimal("0.0365"), MERCANTIL: new Decimal("0.0925") };

export type ItemVenda = { unidade: number; natureza: NaturezaReceita; venda: TipoVenda | null; receitaBruta: Decimal; receitaLiquida: Decimal };
type Valores = { receitaBruta: Decimal; receitaLiquida: Decimal };

export type SeparacaoVenda = {
  /** Por natureza, as receitas da venda global e da mercantil (Matriz e Filial). */
  porNatureza: Array<{ unidade: number; natureza: NaturezaReceita; global: Valores; mercantil: Valores }>;
  /**
   * Os impostos da unidade, abertos como na aba Receitas (Prévia):
   *  - Matriz e Filial: PIS/COFINS de cada venda pela alíquota sobre a bruta
   *    dela; ISS é o resto dos impostos da global, ICMS o da mercantil;
   *  - Obras: PIS/COFINS sobre a ROB e o ISS como resto.
   */
  impostos: Array<{ unidade: number; pisCofinsGlobal: Decimal; pisCofinsMercantil: Decimal; iss: Decimal; icms: Decimal }>;
};

/**
 * Separa a receita prévia em venda global e mercantil e abre os impostos (aba
 * Receitas (Prévia) do BASE PRÉVIAS, a partir de 06/10/2026). A separação só
 * aparece na receita prévia; a DRE continua com os totais.
 */
export function separarPorVenda(itens: ItemVenda[]): SeparacaoVenda {
  const vazio = (): Valores => ({ receitaBruta: zero(), receitaLiquida: zero() });
  const naturezas = new Map<string, SeparacaoVenda["porNatureza"][number]>();
  const porUnidade = new Map<number, { global: Valores; mercantil: Valores; total: Valores }>();
  for (const i of itens) {
    const u = porUnidade.get(i.unidade) ?? { global: vazio(), mercantil: vazio(), total: vazio() };
    porUnidade.set(i.unidade, u);
    for (const alvo of [u.total, ...(i.venda === "GLOBAL" ? [u.global] : i.venda === "MERCANTIL" ? [u.mercantil] : [])]) {
      alvo.receitaBruta = alvo.receitaBruta.plus(i.receitaBruta);
      alvo.receitaLiquida = alvo.receitaLiquida.plus(i.receitaLiquida);
    }
    if (i.unidade === UNIDADE.OBRAS) continue;
    const k = `${i.unidade}|${i.natureza}`;
    const n = naturezas.get(k) ?? { unidade: i.unidade, natureza: i.natureza, global: vazio(), mercantil: vazio() };
    naturezas.set(k, n);
    const alvo = i.venda === "GLOBAL" ? n.global : i.venda === "MERCANTIL" ? n.mercantil : null;
    if (alvo) {
      alvo.receitaBruta = alvo.receitaBruta.plus(i.receitaBruta);
      alvo.receitaLiquida = alvo.receitaLiquida.plus(i.receitaLiquida);
    }
  }
  const impostos = [...porUnidade.entries()].map(([unidade, u]) => {
    if (unidade === UNIDADE.OBRAS) {
      const pis = u.total.receitaBruta.times(PIS_COFINS.GLOBAL);
      return { unidade, pisCofinsGlobal: pis, pisCofinsMercantil: zero(), iss: u.total.receitaBruta.minus(u.total.receitaLiquida).minus(pis), icms: zero() };
    }
    const pisG = u.global.receitaBruta.times(PIS_COFINS.GLOBAL);
    const pisM = u.mercantil.receitaBruta.times(PIS_COFINS.MERCANTIL);
    return {
      unidade,
      pisCofinsGlobal: pisG,
      pisCofinsMercantil: pisM,
      iss: u.global.receitaBruta.minus(u.global.receitaLiquida).minus(pisG),
      icms: u.mercantil.receitaBruta.minus(u.mercantil.receitaLiquida).minus(pisM),
    };
  });
  return {
    porNatureza: [...naturezas.values()].sort((a, b) => a.unidade - b.unidade || a.natureza.localeCompare(b.natureza)),
    impostos: impostos.sort((a, b) => a.unidade - b.unidade),
  };
}
