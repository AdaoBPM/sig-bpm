import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { apurarUnidades, type LinhaEstrutura } from "../src/services/dre/apuracaoUnidades.js";
import { avaliarExpressao } from "../src/services/dre/expressao.js";

const D = (v: number) => new Prisma.Decimal(v);

describe("expressões da estrutura da DRE", () => {
  it("soma, subtrai, agrupa e aceita SUM(a, b)", () => {
    const v = new Map([["A", D(10)], ["B", D(3)], ["C", D(2)]]);
    const val = (c: string) => v.get(c) ?? D(0);
    assert.equal(avaliarExpressao("A + B - C", val).toString(), "11");
    assert.equal(avaliarExpressao("A-(B+C)", val).toString(), "5");
    assert.equal(avaliarExpressao("SUM(A,B)-C", val).toString(), "11");
    assert.throws(() => avaliarExpressao("A + ", val));
  });
});

describe("apuração da DRE por unidade", () => {
  const linha = (codigo: string, grupo: string, grupoSigla: string, atribuicao: string, descricao: string, unidades: number[], tipo: LinhaEstrutura["tipo"] = "ITEM", expressao: string | null = null): LinhaEstrutura => ({
    id: codigo, codigo, tipo, grupo, grupoSigla, atribuicao, descricao, expressao, unidades,
  });
  const linhas: LinhaEstrutura[] = [
    linha("VOL", "PRODUÇÃO (P)", "P", "Produção do Pré-Fabricado (m³)", "Produção do Pré-Fabricado (m³)", [1, 2]),
    linha("CLT", "CUSTOS DE PRODUÇÃO (CP)", "CPP", "Mão de Obra Direta", "Remunerações CLT", [1, 2]),
    linha("DEP", "CUSTOS DE PRODUÇÃO (CP)", "CPP", "Depreciação", "Depreciação do Maquinário", [1, 2]),
    linha("D", "CUSTOS DE PRODUÇÃO (CP)", "CPP", "Depreciação", "Depreciação", [1, 2], "TOTAL", "DEP"),
    linha("CPP", "-", "CPP", "-", "CUSTOS DE PRODUÇÃO: PRÉ-FABRICADOS (CPP)", [1, 2], "SUBTOTAL", "CLT + D"),
  ];
  const base = {
    linhas,
    manuais: [],
    receitas: [],
    totais: new Map([["PREFABRICADO_MATRIZ", D(100)], ["PREFABRICADO_FILIAL", D(300)]]),
    percentuais: new Map([["PRODUCAO|MATRIZ", D(0.25)], ["PRODUCAO|FILIAL", D(0.75)]]),
  };

  it("custo da unidade: diretos da filial + rateio × percentual; subtotal pela expressão", () => {
    const { resultados } = apurarUnidades({
      ...base,
      lancamentos: [
        { filial: 1, linhaDREId: "CLT", balde: "UNIDADE", alocacao: "DIRETO", valor: D(1000) },
        { filial: 2, linhaDREId: "CLT", balde: "UNIDADE", alocacao: "DIRETO", valor: D(500) },
        { filial: 1, linhaDREId: "CLT", balde: "PRODUCAO", alocacao: "RATEIO", valor: D(400) },
        { filial: 2, linhaDREId: "DEP", balde: "UNIDADE", alocacao: "DIRETO", valor: D(80) },
      ],
    });
    const v = (u: number, c: string) => resultados.find((r) => r.unidade === u && r.codigo === c)?.valor.toString();
    assert.equal(v(1, "CLT"), "1100"); // 1.000 + 400 × 25%
    assert.equal(v(2, "CLT"), "800"); // 500 + 400 × 75%
    assert.equal(v(2, "CPP"), "880"); // inclui a depreciação
    assert.equal(v(1, "VOL"), "100");
  });

  it("sem produção na unidade, os custos dela são zero (IF(B$4=0,0,…))", () => {
    const { resultados } = apurarUnidades({
      ...base,
      totais: new Map([["PREFABRICADO_MATRIZ", D(0)], ["PREFABRICADO_FILIAL", D(300)]]),
      lancamentos: [{ filial: 1, linhaDREId: "CLT", balde: "UNIDADE", alocacao: "DIRETO", valor: D(1000) }],
    });
    assert.equal(resultados.find((r) => r.unidade === 1 && r.codigo === "CLT")?.valor.toString(), "0");
  });
});
