import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import { mesesAcima, totaisDaDRE } from "../src/services/cenarios/comparativoCenario.js";
import { classificar } from "../src/services/cenarios/indicadoresDoCenario.js";
import { acharAba, lerAbaDRE, lerAbaMetas } from "../src/services/cenarios/leituraCenario.js";
import { ESTRUTURA_INICIAL_INDICADORES } from "../src/services/relatorios/estruturaInicialIndicadores.js";

const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] => linhas.map((celulas, i) => ({ numero: i + 1, celulas }));
const ESTRUTURA = [
  { id: "a", codigo: "RO", descricao: "RECEITA OPERACIONAL LÍQUIDA (ROL)" },
  { id: "b", codigo: "P.PISTAS", descricao: "Produção do Pré-Fabricado (pistas)" },
  { id: "c", codigo: "CPP.MOD", descricao: "Mão de Obra Direta" },
  { id: "d", codigo: "CSM.MOD", descricao: "Mão de Obra Direta" },
];

describe("leitura do cenário sintético", () => {
  it("acha as abas pelo nome, sem confundir com as (R) e (O)", () => {
    assert.equal(acharAba(["Consolidado (R)", "Desp. +Extra", "Extra RN"], ["Desp.+Extra"]), "Desp. +Extra");
    assert.equal(acharAba(["Consolidado (R)"], ["Consolidado"]), null);
  });

  it("liga as linhas da DRE pela descrição, na ordem, e lê os meses (a primeira coluna de cada mês)", () => {
    const aba = lerAbaDRE(
      0,
      "Consolidado",
      planilha(
        ["PROJEÇÃO: CONSOLIDADO", "JAN/26", "%", "FEV/26", "%", "FEV/26"],
        ["RECEITA OPERACIONAL LÍQUIDA (ROL)", 100, 1, 200, 1, 999],
        ["Produção do Pré-Fabricado (pst)", 5, "-", "-", "-", 0],
        ["Mão de Obra Direta", 10, 0.1, 20, 0.1, 0],
        ["Mão de Obra Direta", 30, 0.3, 40, 0.2, 0],
        ["DESPESAS + EXTRA OPERACIONAL (DEO)", 7, 0, 7, 0, 0],
        ["Linha Nova", 1, 0, 0, 0, 0],
      ),
      ESTRUTURA,
    );
    assert.ok(aba);
    assert.equal(aba.ano, 2026);
    assert.equal(aba.meses, 2);
    const v = (id: string, mes: number) => aba.valores.find((x) => x.linhaDREId === id && x.mes === mes)?.valor;
    assert.equal(v("a", 2), 200);
    assert.equal(v("b", 1), 5);
    assert.equal(v("b", 2), undefined);
    assert.equal(v("c", 1), 10);
    assert.equal(v("d", 2), 40);
    assert.deepEqual(aba.semPar, ["7: Linha Nova"]);
  });

  it("aba com o nome de uma unidade que não é DRE fica de fora", () => {
    assert.equal(lerAbaDRE(3, "Serviços", planilha(["GRUPO", "INDICADOR", "JAN/2026"], ["Serviços", "Rendimento: Montagem", 1]), ESTRUTURA), null);
  });

  it("lê as metas pelo nome do indicador, com o apelido do quadro de lotação", () => {
    const m = lerAbaMetas(
      "Metas",
      planilha(["GRUPO", "INDICADOR", "TIPO", "JAN/2026", "FEV/2026", "ACUM. (O)"], ["x", "Turnover", "↓", 0.02, 0.03, 0.05], ["x", "Quadro de Lotação", "=", 300, null, 300], ["x", "Outro", "=", 1, 1, 1]),
      ["Turnover", "Quadro de Lotação Total"],
    );
    assert.ok(m);
    assert.equal(m.ano, 2026);
    assert.deepEqual(m.valores, [
      { nome: "Turnover", mes: 1, valor: 0.02 },
      { nome: "Turnover", mes: 2, valor: 0.03 },
      { nome: "Quadro de Lotação Total", mes: 1, valor: 300 },
    ]);
    assert.deepEqual(m.ignorados, ["Outro"]);
  });

  it("classifica os indicadores: da DRE, manuais, calculados (eficiências) e importados", () => {
    const classe = new Map(ESTRUTURA_INICIAL_INDICADORES.map((i) => [i.nome, classificar(i)]));
    assert.equal(classe.get("Custos de Produção: Matriz (CPP)"), "RESULTADO");
    assert.equal(classe.get("Quadro de Lotação: MO Direta Matriz"), "MANUAL");
    assert.equal(classe.get("Venda: Total"), "MANUAL");
    assert.equal(classe.get("Eficiência da Produção: MO Direta Matriz"), "CALCULADO");
    assert.equal(classe.get("Eficiência da Operação: MO Geral Total"), "CALCULADO");
    assert.equal(classe.get("Liberação de Projetos: Total"), "IMPORTADO");
    assert.equal(classe.get("Atingimento da MC Acumulada"), "IMPORTADO");
    const contagem = [...classe.values()].reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {});
    assert.deepEqual(contagem, { RESULTADO: 49, MANUAL: 33, CALCULADO: 25, IMPORTADO: 7 });
  });
});

describe("comparativo entre cenários", () => {
  const linha = (codigo: string, tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL", descricao = codigo) => ({ id: codigo, codigo, tipo, grupo: "", grupoSigla: "", atribuicao: null, descricao, expressao: null, unidades: [] });
  it("os totais são os do nível Totais; cada conta fica sob o último total, e o total sem contas se verifica ele mesmo", () => {
    const { totais, verificadas } = totaisDaDRE([
      linha("PS.PRODUCAO", "SECAO"),
      linha("P.PISTAS", "ITEM"),
      linha("RO.ROL", "TOTAL"),
      linha("ROB.ROB", "SUBTOTAL"),
      linha("ROB.RBPF", "ITEM"),
      linha("CPP.CPP", "SUBTOTAL"),
      linha("CPP.MOD.MAO", "SUBTOTAL"),
      linha("CPP.MOD.CLT", "ITEM"),
      linha("MB.MB", "TOTAL"),
    ]);
    assert.deepEqual(totais.map((t) => t.codigo), ["RO.ROL", "ROB.ROB", "CPP.CPP", "MB.MB"]);
    assert.deepEqual(
      verificadas.map((v) => `${v.total.codigo}:${v.linha.codigo}`),
      ["RO.ROL:RO.ROL", "ROB.ROB:ROB.RBPF", "CPP.CPP:CPP.MOD.CLT", "MB.MB:MB.MB"],
    );
  });
  it("os meses acima da variação máxima, para mais ou para menos; sem base quando o comparado é zero", () => {
    const valores = new Map([[1, 110], [2, 89], [3, 50], [4, 100]]);
    const comparados = new Map([[1, 100], [2, 100], [4, 100]]);
    assert.deepEqual(mesesAcima(valores, comparados, 10), [
      { mes: 2, valor: 89, comparado: 100, variacao: -11 },
      { mes: 3, valor: 50, comparado: 0, variacao: null },
    ]);
    // O comparado negativo (um custo): a variação é sobre o valor absoluto.
    assert.equal(mesesAcima(new Map([[1, -130]]), new Map([[1, -100]]), 10)[0].variacao, -30);
    // Igual à máxima em duas casas não entra (5% sobre centavos dá 5,0000005%); 5,01% entra.
    assert.deepEqual(mesesAcima(new Map([[1, 168056.29]]), new Map([[1, 160053.6088]]), 5), []);
    assert.equal(mesesAcima(new Map([[1, 105.01]]), new Map([[1, 100]]), 5)[0].variacao, 5.01);
  });
});
