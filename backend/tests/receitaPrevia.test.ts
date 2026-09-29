import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import {
  calcularReceita,
  grupoDaEstaca,
  pecaDaEstaca,
  totalizar,
  type DadosCalculo,
  type PrecoVigente,
} from "../src/services/receitaPrevia/calculoReceita.js";

const D = (v: number | string) => new Prisma.Decimal(v);
const preco = (obra: string, linha: string, atribuicao: string, unit: number | null, extra: Partial<PrecoVigente> = {}): PrecoVigente => ({
  id: `${obra}-${linha}-${atribuicao}`,
  obra,
  versao: 0,
  linha,
  atribuicao,
  departamento: null,
  valorUnitario: unit === null ? null : D(unit),
  valorTotal: null,
  ...extra,
});
const vazio = (): DadosCalculo => ({
  precos: [],
  estacas: [{ grupo: "ES", secao: "26,5X26,5", peca: "ES26", precoLiquido: D(1000) }],
  movimentos: new Set(["1.2.18"]),
  producoes: [],
  expedicoes: [],
  saidas: [],
  devolucoes: [],
  medicoes: [],
  lancamentos: [],
});
const total = (d: DadosCalculo, unidade: number, natureza: string) =>
  totalizar(calcularReceita(d).itens).find((t) => t.unidade === unidade && t.natureza === natureza);

describe("receita prévia", () => {
  it("peça de estaca: grupo na produção e código na expedição", () => {
    assert.deepEqual(["ESD35-8", "ES26-10", "E16-12"].map(grupoDaEstaca), ["ESD", "ES", "E"]);
    assert.deepEqual(["ESD35-8", "ES26-10", "E16-12"].map(pecaDaEstaca), ["ESD35", "ES26", "E16"]);
  });

  it("produção: preço do contrato; sem contrato e genérica, 3.500 (ou 2.000 alveolar) de líquida e /0,93 de bruta", () => {
    const d = vazio();
    d.precos = [preco("L1", "ALVEOLARES", "Receita Bruta do Pré-Fabricado", 1500), preco("L1", "ALVEOLARES", "Receita Líquida do Pré-Fabricado", 1400)];
    d.producoes = [
      { id: "a", obra: "L1", unidade: 2, linha: "ALVEOLARES", quantidade: D(10) },
      { id: "b", obra: "L9", unidade: 2, linha: "ALVEOLARES", quantidade: D(1) },
      { id: "c", obra: "G11", unidade: 1, linha: "ESTRUTURA", quantidade: D(1) },
    ];
    const f = total(d, 2, "PRE_FABRICADO")!;
    assert.equal(f.receitaBruta.toFixed(2), (15000 + 2000 / 0.93).toFixed(2));
    assert.equal(f.receitaLiquida.toFixed(2), "16000.00");
    assert.equal(f.impostos.toFixed(2), (15000 + 2000 / 0.93 - 16000).toFixed(2));
    assert.equal(total(d, 1, "PRE_FABRICADO")!.receitaLiquida.toFixed(2), "3500.00");
  });

  it("estaca: sem receita na produção; na expedição, contrato ou tabela, e a variação do estoque na Filial", () => {
    const d = vazio();
    d.precos = [preco("E1", "ESTACAS", "Receita Bruta do Pré-Fabricado", 1600), preco("E1", "ESTACAS", "Receita Líquida do Pré-Fabricado", 1500)];
    d.producoes = [{ id: "p", obra: "E1", unidade: 2, linha: "ESTACAS", quantidade: D(2), nomePeca: "ES26-10", secao: "26,5X26,5" }];
    d.expedicoes = [
      { id: "x", obra: "E1", unidade: 2, linha: "ESTACAS", quantidade: D(1), nomePeca: "ES26-10" },
      { id: "y", obra: "E9", unidade: 2, linha: "ESTACAS", quantidade: D(1), nomePeca: "ES26-10" },
    ];
    const f = total(d, 2, "PRE_FABRICADO")!;
    // Contrato: 1600; sem contrato: o valor da tabela (1000) na bruta e na líquida.
    assert.equal(f.receitaBruta.toFixed(2), "2600.00");
    assert.equal(f.receitaLiquida.toFixed(2), "2500.00");
    // Variação: -(produção 2 × 1000) + expedição (2 × 1000) = 0.
    assert.equal(f.variacaoEstoque.toFixed(2), "0.00");
  });

  it("frete: só com contrato; sem DRE, zero", () => {
    const d = vazio();
    d.precos = [preco("G1", "ESTRUTURA", "Receita Bruta de Frete", 200), preco("G1", "ESTRUTURA", "Receita Líquida de Frete", 190)];
    d.expedicoes = [
      { id: "a", obra: "G1", unidade: 1, linha: "ESTRUTURA", quantidade: D(3) },
      { id: "b", obra: "G2", unidade: 1, linha: "ESTRUTURA", quantidade: D(3) },
    ];
    const f = total(d, 1, "FRETE")!;
    assert.equal(f.receitaBruta.toFixed(2), "600.00");
    assert.equal(f.receitaLiquida.toFixed(2), "570.00");
  });

  it("saídas e devoluções: nota menos créditos; devolução só com movimento da tabela", () => {
    const d = vazio();
    d.saidas = [{ id: "s", obra: null, unidade: 1, linha: "METALÚRGICA", quantidade: D(1), valor: D(800), creditos: D(0) }];
    d.devolucoes = [
      { id: "d1", obra: "L1", unidade: 2, linha: "ALVEOLARES", quantidade: D(1), valor: D(1000), creditos: D(160), movimento: "1.2.18" },
      { id: "d2", obra: "L1", unidade: 2, linha: "ALVEOLARES", quantidade: D(1), valor: D(500), creditos: D(10), movimento: "1.2.33" },
    ];
    assert.equal(total(d, 1, "PRE_FABRICADO")!.receitaBruta.toFixed(2), "800.00");
    const dev = total(d, 2, "DEVOLUCOES_INVENTARIOS")!;
    assert.equal(dev.receitaBruta.toFixed(2), "-1000.00");
    assert.equal(dev.receitaLiquida.toFixed(2), "-840.00");
    assert.match(calcularReceita(d).avisos.join(" "), /1\.2\.33/);
  });

  it("serviços: montagem e vedação à parte; líquida pela proporção IRB/ROB da MONTAGEM da DRE", () => {
    const d = vazio();
    d.precos = [
      preco("G1", "MONTAGEM", "x", null, { id: "rob", departamento: "ROB", valorTotal: D(1000) }),
      preco("G1", "MONTAGEM", "y", null, { id: "irb", departamento: "IRB", valorTotal: D(60) }),
    ];
    d.medicoes = [
      { id: "m1", obra: "G1", unidade: 3, linha: "MONTAGEM", quantidade: D(0.1), valorMedido: D(100) },
      { id: "m2", obra: "G1", unidade: 3, linha: "FUNDAÇÃO", quantidade: D(0.1), valorMedido: D(50) },
      { id: "m3", obra: "G2", unidade: 3, linha: "VEDAÇÃO", quantidade: D(0.1), valorMedido: D(10) },
    ];
    const m = total(d, 3, "MONTAGEM")!;
    assert.equal(m.receitaBruta.toFixed(2), "110.00");
    // G2 não tem ROB de MONTAGEM: como na planilha ("X"), fica fora da líquida.
    assert.equal(m.receitaLiquida.toFixed(2), "94.00");
    assert.equal(total(d, 3, "COMPLEMENTAR")!.receitaLiquida.toFixed(2), "47.00");
  });

  it("lançamento manual entra na parte que ajusta", () => {
    const d = vazio();
    d.lancamentos = [{ id: "l", unidade: 2, natureza: "PRE_FABRICADO", componente: "VARIACAO_ESTOQUE", valor: D(-50), observacao: "inventário" }];
    const f = total(d, 2, "PRE_FABRICADO")!;
    assert.equal(f.variacaoEstoque.toFixed(2), "-50.00");
    assert.equal(f.receitaBruta.toFixed(2), "0.00");
  });
});
