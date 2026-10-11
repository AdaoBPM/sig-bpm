import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compilarFormula, FormulaInvalidaError, formulaPorExtenso } from "../src/services/relatorios/formulaIndicador.js";

describe("fórmula dos indicadores (Estrutura dos Indicadores)", () => {
  const valores: Record<string, number> = { "DRE|1|A": 72, "DRE|1|B": 100, "LISTA|PROJETOS_TOTAL": 50, "IND|Venda: Total": 0 };
  const valor = (k: string) => valores[k] ?? NaN;

  it("respeita a precedência, os parênteses, o menos e os números", () => {
    assert.equal(compilarFormula("[DRE|1|A] / [DRE|1|B]").avaliar(valor), 0.72);
    assert.equal(compilarFormula("([DRE|1|A] + 28) / [DRE|1|B] * 2").avaliar(valor), 2);
    assert.equal(compilarFormula("[DRE|1|A] + 28 / 4").avaliar(valor), 79);
    assert.equal(compilarFormula("-[LISTA|PROJETOS_TOTAL] + 100").avaliar(valor), 50);
    assert.equal(compilarFormula("[DRE|1|B] / 1000").avaliar(valor), 0.1);
  });

  it("fica sem valor com divisão por zero ou item sem dado", () => {
    assert.equal(compilarFormula("[DRE|1|A] / [IND|Venda: Total]").avaliar(valor), null);
    assert.equal(compilarFormula("[DRE|1|A] + [DRE|2|X]").avaliar(valor), null);
  });

  it("recusa fórmula mal escrita", () => {
    for (const f of ["", "[DRE|1|A] +", "([DRE|1|A]", "[DRE|9|A]", "[XYZ|A]", "[DRE|1|A] [DRE|1|B]", "2 $ 3"]) {
      assert.throws(() => compilarFormula(f), FormulaInvalidaError, f);
    }
  });

  it("escreve a fórmula por extenso", () => {
    const rotulo = (i: { tipo: string; codigo?: string; nome?: string }) => (i.tipo === "DRE" ? `Linha ${i.codigo}` : (i.nome ?? i.codigo ?? ""));
    assert.equal(formulaPorExtenso("([DRE|1|A] - [DRE|1|B]) / [IND|Venda: Total] * 100", rotulo as never), "(Linha A − Linha B) ÷ Venda: Total × 100");
  });
});
