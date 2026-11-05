import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { comAsPrevias, foraDaObra, type PreviasDaObra } from "../src/services/dre/obrasService.js";

const D = (v: number) => new Prisma.Decimal(v);
const RBPF = "ROB.RBPF.RECEITA_BRUTA_DO_PRE_FABRICADO";
const RBF = "ROB.RBF.RECEITA_BRUTA_DE_FRETE";
const RBM = "ROB.RBM.RECEITA_BRUTA_DE_MONTAGEM";
const RBC = "ROB.RBC.RECEITA_BRUTA_COMPLEMENTAR";

describe("As receitas da aba Obras (03/11/2026)", () => {
  it("as contas de Reconhecimento do CPV ficam fora só nas linhas de receita", () => {
    assert.ok(foraDaObra(RBPF, { descricao: "RECONHECIMENTO DO CPV (ESTRUTURA)" }));
    assert.ok(foraDaObra(RBPF, { descricao: "Reconhecimento do CPV (Estacas e Alveolares)" }));
    assert.ok(foraDaObra(RBM, { descricao: "RECONHECIMENTO DO CPV (SERVIÇOS)" }));
    assert.ok(!foraDaObra(RBPF, { descricao: "FATURAMENTO DE ESTRUTURA APLICADOS EM OBRAS" }));
    assert.ok(!foraDaObra("CPP.MP.CIMENTO", { descricao: "RECONHECIMENTO DO CPV (ESTRUTURA)" }));
  });

  it("o frete sai do Pré-Fabricado e vai ao Frete; a complementar sai da Montagem e vai à Complementar", () => {
    const itens = new Map([
      [RBPF, { valor: D(148324.56), n: 3 }],
      [RBM, { valor: D(1260522.53), n: 1 }],
    ]);
    const previas: PreviasDaObra = new Map([
      ["FRETE", new Map([[1, D(20000)], [2, D(3847.69)]])],
      ["COMPLEMENTAR", new Map([[3, D(1007279.14)]])],
    ]);
    const r = comAsPrevias(itens, previas);
    assert.equal(r.get(RBPF)!.valor.toFixed(2), "124476.87");
    assert.equal(r.get(RBF)!.valor.toFixed(2), "23847.69");
    assert.equal(r.get(RBM)!.valor.toFixed(2), "253243.39");
    assert.equal(r.get(RBC)!.valor.toFixed(2), "1007279.14");
    // A ROB da obra não muda: só troca de item.
    const soma = (m: Map<string, { valor: Prisma.Decimal }>) => [...m.values()].reduce((s, x) => s.plus(x.valor), D(0)).toFixed(2);
    assert.equal(soma(r), soma(itens));
    // Os itens de entrada ficam como estavam.
    assert.equal(itens.get(RBPF)!.valor.toFixed(2), "148324.56");
  });

  it("sem receita no balancete, o frete da obra deixa o Pré-Fabricado negativo e a ROB igual", () => {
    const r = comAsPrevias(new Map(), new Map([["FRETE", new Map([[1, D(3588.79)]])]]));
    assert.equal(r.get(RBPF)!.valor.toFixed(2), "-3588.79");
    assert.equal(r.get(RBF)!.valor.toFixed(2), "3588.79");
  });

  it("sem receita prévia, os itens ficam iguais", () => {
    const itens = new Map([[RBPF, { valor: D(10), n: 1 }]]);
    assert.equal(comAsPrevias(itens, undefined), itens);
  });
});
