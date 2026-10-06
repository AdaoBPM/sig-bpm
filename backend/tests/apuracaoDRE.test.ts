import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import { apurarUnidades, type LinhaEstrutura } from "../src/services/dre/apuracaoUnidades.js";
import { apurarCentros, consolidar } from "../src/services/dre/consolidacao.js";
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

  it("custo da unidade: diretos do balde da unidade e do UNIDADE da filial + rateio × percentual; subtotal pela expressão", () => {
    const { resultados } = apurarUnidades({
      ...base,
      lancamentos: [
        { filial: 1, linhaDREId: "CLT", balde: "UNIDADE", alocacao: "DIRETO", valor: D(1000) },
        { filial: 2, linhaDREId: "CLT", balde: "UNIDADE", alocacao: "DIRETO", valor: D(500) },
        { filial: 1, linhaDREId: "CLT", balde: "PRODUCAO", alocacao: "RATEIO", valor: D(400) },
        { filial: 2, linhaDREId: "DEP", balde: "UNIDADE", alocacao: "DIRETO", valor: D(80) },
        // Os baldes MATRIZ e FILIAL forçam o gasto para a unidade, de qualquer filial.
        { filial: 2, linhaDREId: "CLT", balde: "MATRIZ", alocacao: "DIRETO", valor: D(50) },
        { filial: 1, linhaDREId: "CLT", balde: "FILIAL", alocacao: "DIRETO", valor: D(20) },
        // DESPESAS não entra nos custos da unidade.
        { filial: 1, linhaDREId: "CLT", balde: "DESPESAS", alocacao: "DIRETO", valor: D(7) },
      ],
    });
    const v = (u: number, c: string) => resultados.find((r) => r.unidade === u && r.codigo === c)?.valor.toString();
    assert.equal(v(1, "CLT"), "1150"); // 1.000 + 50 (MATRIZ da filial 2) + 400 × 25%
    assert.equal(v(2, "CLT"), "820"); // 500 + 20 (FILIAL da filial 1) + 400 × 75%
    assert.equal(v(2, "CPP"), "900"); // inclui a depreciação
    assert.equal(v(1, "VOL"), "100");
    // A composição guarda a origem que o detalhamento usa: os pares de balde e filial e o rateio na linha de base.
    const c = resultados.find((r) => r.unidade === 2 && r.codigo === "CLT")?.composicao;
    assert.deepEqual(c?.origem?.contabil, { linhaId: "CLT", pares: [{ balde: "FILIAL" }, { balde: "UNIDADE", filial: 2 }] });
    assert.deepEqual(c?.rateios?.map((r) => [r.chave, r.linhaId, r.valor]), [["PRODUCAO", "CLT", "300.00"]]);
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

describe("consolidação e visão por centro de custo", () => {
  const linha = (codigo: string, tipo: LinhaEstrutura["tipo"], expressao: string | null = null): LinhaEstrutura => ({
    id: `id-${codigo}`, codigo, tipo, grupo: "G", grupoSigla: "G", atribuicao: "A", descricao: codigo, expressao, unidades: [],
  });
  const linhas = [
    linha("ROB", "SUBTOTAL", "RB"),
    linha("RB", "ITEM"),
    linha("IO", "TOTAL", "ROB-ROL"),
    linha("ROL", "SUBTOTAL", "RL"),
    linha("RL", "ITEM"),
    linha("CPP", "SUBTOTAL", "CLT + DEP"),
    linha("CLT", "ITEM"),
    linha("DEP", "ITEM"),
    linha("MB", "TOTAL", "ROL-CPP"),
  ];
  const r = (unidade: number, codigo: string, v: number, tipo = "ITEM") => ({ unidade, linhaId: `id-${codigo}`, codigo, valor: D(v), composicao: tipo === "ITEM" ? { regra: "x" } : null });

  it("consolidado: itens somados entre as unidades, subtotais e impostos pela estrutura", () => {
    const c = consolidar(linhas, [r(1, "RB", 100), r(2, "RB", 50), r(1, "RL", 90), r(2, "RL", 45), r(1, "IO", 999, "TOTAL"), r(1, "CLT", 30), r(2, "CLT", 20)]);
    const v = (codigo: string) => c.find((x) => x.codigo === codigo)?.valor.toString();
    assert.equal(v("RB"), "150");
    assert.equal(v("IO"), "15"); // ROB − ROL, não a soma das unidades
    assert.equal(v("CPP"), "50");
    assert.equal(v("MB"), "85");
    assert.deepEqual(c.find((x) => x.codigo === "CLT")?.composicao?.unidades?.map((p) => p.valor), ["30.00", "20.00"]);
    assert.equal(v("DEP"), undefined); // item sem valor em nenhuma unidade não entra
  });

  it("centro de custo: lançamentos por linha e só os agregadores que somam", () => {
    const c = apurarCentros(linhas, [
      { centroCustoId: "A", linhaDREId: "id-CLT", valor: D(10) },
      { centroCustoId: "A", linhaDREId: "id-CLT", valor: D(5) },
      { centroCustoId: "A", linhaDREId: "id-DEP", valor: D(2) },
      { centroCustoId: "B", linhaDREId: "id-CLT", valor: D(7) },
      { centroCustoId: null, linhaDREId: "id-CLT", valor: D(100) },
    ]);
    const v = (centro: string, codigo: string) => c.find((x) => x.centroCustoId === centro && x.codigo === codigo)?.valor.toString();
    assert.equal(v("A", "CLT"), "15");
    assert.equal(v("A", "CPP"), "17");
    assert.equal(v("B", "CPP"), "7");
    assert.equal(v("A", "MB"), undefined); // margem (com subtração) fica de fora
    assert.equal(c.filter((x) => x.centroCustoId === null).length, 0);
  });
});
