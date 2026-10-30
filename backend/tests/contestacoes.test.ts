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

  it("soma os movimentos pela competência, pela filial, pelo centro e pela conta de antes, na ordem das competências", () => {
    const grupos = agruparParaLancamentos([
      m(1, "c1", "k1", "200.20", 2026, 2),
      m(1, "c1", "k1", "100.10", 2026, 1),
      m(1, "c1", "k1", "50", 2026, 2),
      m(2, "c1", "k1", "10", 2026, 3),
      m(1, null, "k1", "5", 2026, 3),
      m(1, "c1", "k1", "1", 2025, 12),
    ]);
    assert.deepEqual(
      grupos.map((g) => [g.competencia.id, g.filial, g.centroAntesId, g.valor.toFixed(2), g.movimentos]),
      [
        ["2025-12", 1, "c1", "1.00", 1],
        ["2026-1", 1, "c1", "100.10", 1],
        ["2026-2", 1, "c1", "250.20", 2],
        ["2026-3", 2, "c1", "10.00", 1],
        ["2026-3", 1, null, "5.00", 1],
      ],
    );
  });
});
