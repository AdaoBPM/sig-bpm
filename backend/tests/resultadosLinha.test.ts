import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { alocar, fracoesDaTarefa, numeroDaObra, porPesos, semLinha, type Passo } from "../src/services/resultadosLinha/alocacaoNasLinhas.js";

const soma = (xs: Array<{ valor: number }>) => xs.reduce((s, x) => s + x.valor, 0);

describe("Resultados por Linha (26/10/2026)", () => {
  it("divide pelos pesos, na proporção", () => {
    assert.deepEqual(porPesos(100, new Map([["A", 3], ["B", 1]])), [["A", 75], ["B", 25]]);
    assert.deepEqual(porPesos(100, new Map()), []);
  });

  it("a tarefa explica só a parte dos documentos (sobre o maior entre o balancete e os documentos)", () => {
    // Balancete 100, documentos com tarefa 40 (A) e 20 (B), sem tarefa 10: A fica com 40%, B com 20%.
    assert.deepEqual([...fracoesDaTarefa(100, new Map([["A", 40], ["B", 20]]), 10)], [["A", 0.4], ["B", 0.2]]);
    // Documentos maiores que o balancete: sobre os documentos (60 + 60 = 120).
    assert.deepEqual([...fracoesDaTarefa(100, new Map([["A", 60]]), 60)], [["A", 0.5]]);
    // Sem valor positivo no balancete ou nos documentos com tarefa, nenhuma.
    assert.equal(fracoesDaTarefa(-50, new Map([["A", 40]]), 0).size, 0);
    assert.equal(fracoesDaTarefa(100, new Map([["A", -5]]), 0).size, 0);
  });

  it("a ordem: a tarefa, depois o primeiro passo com pesos; nada se perde", () => {
    const vazio: Passo = { nivel: "CENTRO", pesos: () => null };
    const obra: Passo = { nivel: "OBRA", pesos: () => new Map([["A", 1], ["C", 1]]) };
    const unidade: Passo = { nivel: "UNIDADE", pesos: () => new Map([["B", 1]]) };
    const partes = alocar(200, new Map([["A", 0.25]]), [vazio, obra, unidade], semLinha(1));
    assert.deepEqual(partes, [
      { linhaId: "A", nivel: "TAREFA", valor: 50 },
      { linhaId: "A", nivel: "OBRA", valor: 75 },
      { linhaId: "C", nivel: "OBRA", valor: 75 },
    ]);
    assert.equal(soma(partes), 200);
  });

  it("sem nenhum passo com pesos, o resto fica Sem Linha da unidade", () => {
    const partes = alocar(80, new Map(), [{ nivel: "RATEIO", pesos: () => new Map() }], semLinha(3));
    assert.deepEqual(partes, [{ linhaId: "SEM_LINHA|3", nivel: "SEM_LINHA", valor: 80 }]);
  });

  it("o número da obra, do código da obra ou do centro de obra", () => {
    assert.equal(numeroDaObra("G829003"), "829003");
    assert.equal(numeroDaObra("1.98.00829003"), "829003");
    assert.equal(numeroDaObra("1.98.00003171"), "3171");
    assert.equal(numeroDaObra("3171"), "3171");
  });
});
