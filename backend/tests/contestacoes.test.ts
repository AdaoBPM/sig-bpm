import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { departamentoDaLinha } from "../src/services/acesso/recorteDepartamento.js";
import { agruparParaLancamentos, contaCabeNoCentro } from "../src/services/contestacoes/contestacoesService.js";

describe("Contestações de Gastos: a conta no departamento do centro (30/10/2026)", () => {
  const conta = (grupoSigla: string, descricao = "X") => departamentoDaLinha({ grupoSigla, descricao });

  it("aceita as contas do departamento do centro e as do Extra-Operacional", () => {
    assert.equal(contaCabeNoCentro("PRODUCAO", conta("CPP")), true);
    assert.equal(contaCabeNoCentro("PRODUCAO", conta("DFC")), true);
    assert.equal(contaCabeNoCentro("PRODUCAO", conta("DML")), true);
    assert.equal(contaCabeNoCentro("SERVICOS", conta("CSC")), true);
    assert.equal(contaCabeNoCentro("LOGISTICA", conta("DVV", "FRETE E DESCARGA")), true);
  });

  it("recusa as de outro departamento e as sem departamento (receitas e impostos)", () => {
    assert.equal(contaCabeNoCentro("PRODUCAO", conta("DA")), false);
    assert.equal(contaCabeNoCentro("ADMINISTRATIVO", conta("CPP")), false);
    assert.equal(contaCabeNoCentro("COMERCIAL", conta("DVV", "FRETE E DESCARGA")), false);
    assert.equal(contaCabeNoCentro("PRODUCAO", conta("ROB")), false);
  });

  it("o centro sem departamento (o do movimento, quando só a conta muda) aceita todas", () => {
    assert.equal(contaCabeNoCentro(null, conta("DA")), true);
    assert.equal(contaCabeNoCentro(null, conta("ROB")), true);
  });
});

describe("Contestações de Gastos: os lançamentos das anteriores e posteriores (30/10/2026)", () => {
  const m = (filial: number, centro: string | null, conta: string, valor: string, ano: number, mes: number) => ({
    filial,
    centroAntesId: centro,
    contaAntesId: conta,
    valor: new Prisma.Decimal(valor),
    competencia: { id: `${ano}-${mes}`, ano, mes },
  });

  it("soma os movimentos pela filial, pelo centro e pela conta de antes, com as competências", () => {
    const grupos = agruparParaLancamentos([
      m(1, "c1", "k1", "200.20", 2026, 2),
      m(1, "c1", "k1", "100.10", 2026, 1),
      m(1, "c1", "k1", "50", 2026, 2),
      m(2, "c1", "k1", "10", 2026, 3),
      m(1, null, "k1", "5", 2026, 3),
    ]);
    assert.equal(grupos.length, 3);
    const g1 = grupos.find((g) => g.filial === 1 && g.centroAntesId === "c1")!;
    assert.equal(g1.valor.toFixed(2), "350.30");
    assert.equal(g1.movimentos, 3);
    assert.deepEqual(g1.competencias, ["01/2026", "02/2026"]);
    assert.equal(grupos.find((g) => g.filial === 2)!.valor.toFixed(2), "10.00");
    assert.equal(grupos.find((g) => g.centroAntesId === null)!.movimentos, 1);
    assert.ok(grupos.every((g) => g.competenciaRateioId === null));
  });

  it("os movimentos com rateio não se somam entre competências: cada grupo leva a sua", () => {
    const grupos = agruparParaLancamentos(
      [m(1, "met", "k1", "100", 2026, 1), m(1, "met", "k1", "200", 2026, 2), m(1, "met", "k1", "50", 2026, 2), m(1, "c1", "k1", "7", 2026, 1), m(1, "c1", "k1", "3", 2026, 2)],
      (x) => x.centroAntesId === "met",
    );
    assert.deepEqual(
      grupos.map((g) => [g.centroAntesId, g.competenciaRateioId, g.valor.toFixed(2), g.competencias.join(" ")]),
      [
        ["met", "2026-1", "100.00", "01/2026"],
        ["met", "2026-2", "250.00", "02/2026"],
        ["c1", null, "10.00", "01/2026 02/2026"],
      ],
    );
  });
});
