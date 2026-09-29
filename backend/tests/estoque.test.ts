import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { calcularEstoque, mediasPorLinha } from "../src/services/estoque/calculoEstoque.js";

const D = (v: number) => new Prisma.Decimal(v);

describe("saldo de estoque", () => {
  const dados = () => ({
    anterior: [{ obra: "L1", linha: "ALVEOLARES", saldoVolume: D(10), saldoValor: D(15000) }],
    producoes: [
      { obra: "L1", linha: "ALVEOLARES", quantidade: D(5) },
      { obra: "G9", linha: "ESTRUTURA", quantidade: D(2) },
      { obra: "E1", linha: "ESTACAS", quantidade: D(3), nomePeca: "ES26-10", secao: "26,5X26,5" },
    ],
    expedicoes: [
      { obra: "L1", linha: "ALVEOLARES", quantidade: D(8) },
      { obra: "E2", linha: "ESTACAS", quantidade: D(1), nomePeca: "ES26-10" },
    ],
    precos: [{ obra: "L1", versao: 0, linha: "ALVEOLARES", contaResultado: "Receita Líquida do Pré-Fabricado", valorUnitario: D(1400) }],
    estacas: [{ grupo: "ES", secao: "26,5X26,5", peca: "ES26", precoLiquido: D(1000) }],
  });

  it("saldo = anterior + produção − expedição; valor pelo contrato, pelo padrão ou pela tabela", () => {
    const { saldos } = calcularEstoque(dados());
    const de = (obra: string, linha: string) => saldos.find((s) => s.obra === obra && s.linha === linha)!;
    const l1 = de("L1", "ALVEOLARES");
    assert.equal(l1.saldoVolume.toFixed(3), "7.000");
    // 15.000 + (5 − 8) × 1.400
    assert.equal(l1.saldoValor.toFixed(2), "10800.00");
    // Obra sem DRE: 3.500 por m³ na estrutura.
    assert.equal(de("G9", "ESTRUTURA").saldoValor.toFixed(2), "7000.00");
    // Estacas vão todas para o depósito M9999, pela tabela: +3 × 1.000 − 1 × 1.000.
    const est = de("M9999", "ESTACAS");
    assert.equal(est.saldoVolume.toFixed(3), "2.000");
    assert.equal(est.saldoValor.toFixed(2), "2000.00");
    assert.equal(est.criterio, "TABELA_ESTACA");
  });

  it("preço médio por linha e geral é Σ R$ / Σ m³", () => {
    const { saldos } = calcularEstoque(dados());
    const m = mediasPorLinha(saldos);
    assert.equal(m.ALVEOLARES.precoMedio.toFixed(2), (10800 / 7).toFixed(2));
    assert.equal(m.GERAL.precoMedio.toFixed(2), ((10800 + 7000 + 2000) / 11).toFixed(2));
  });
});
