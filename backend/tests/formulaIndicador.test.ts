import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compilarFormula, FormulaInvalidaError, formulaPorExtenso } from "../src/services/relatorios/formulaIndicador.js";
import { contaDaFormula, indicadoresDaFormula, quadrosDoCadastro } from "../src/services/relatorios/painelDeBordo.js";

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

describe("Metodologia dos itens do Painel de Bordo (17/10/2026)", () => {
  const valores: Record<string, number | null> = { "Receita Líquida: Total": 200, "Margem Bruta (MB): Total": 50, "Zero": 0, "Sem Dado": null };
  const x = (n: string) => valores[n] ?? null;

  it("calcula a fórmula sobre os indicadores, sem valor com divisão por zero ou indicador sem dado", () => {
    assert.equal(contaDaFormula("[INDICADOR|Margem Bruta (MB): Total] / [INDICADOR|Receita Líquida: Total]")(x), 0.25);
    assert.equal(contaDaFormula("[INDICADOR|Margem Bruta (MB): Total] / [INDICADOR|Zero]")(x), null);
    assert.equal(contaDaFormula("[INDICADOR|Margem Bruta (MB): Total] + [INDICADOR|Sem Dado]")(x), null);
    assert.deepEqual(indicadoresDaFormula("[INDICADOR|A] * ([INDICADOR|B] + 1)"), ["A", "B"]);
  });

  it("monta os quadros do cadastro na ordem, com o formato, o percentual e o espaço antes", () => {
    const base = { sentido: "↑", formatoAcumulado: null, percentual: null, casasPercentual: 1, separar: false, formato: "MILHOES" };
    const q = quadrosDoCadastro([
      { ...base, grupo: "RESULTADOS", quadro: "Consolidado", nome: "Receita", sigla: "ROL", formula: "[INDICADOR|Receita Líquida: Total]" },
      { ...base, grupo: "PERFORMANCE", quadro: "Vendas", nome: "Margem", sigla: "MB", formula: "[INDICADOR|Margem Bruta (MB): Total]", percentual: "[INDICADOR|Margem Bruta (MB): Total] / [INDICADOR|Receita Líquida: Total]", casasPercentual: 2, separar: true },
      { ...base, grupo: "RESULTADOS", quadro: "Consolidado", nome: "Quebrado", sigla: "Q", formula: "[INDICADOR|A] +" },
    ]);
    assert.deepEqual(q.resultados.map((r) => [r.titulo, r.itens.map((i) => i.sigla)]), [["Consolidado", ["ROL"]]]);
    const mb = q.performance[0].itens[0];
    assert.equal(mb.conta(x), 50);
    assert.equal(mb.base?.conta(x), 0.25);
    assert.equal(mb.base?.casas, 2);
    assert.equal(mb.separar, true);
  });
});
