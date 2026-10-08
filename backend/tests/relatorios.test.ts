import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baseDoPercentual, baseDoUnitario, COD } from "../src/services/relatorios/basesResultados.js";
import { acumular, INDICADORES, valorDaParte } from "../src/services/relatorios/indicadores.js";

const linha = (codigo: string) => ({ codigo, grupoSigla: codigo.split(".")[0] });

describe("relatório de Resultados: bases do % e do R$/m³ (abas Resultados (…), 08/10/2026)", () => {
  it("receitas sobre a ROB; custos sobre a receita líquida da natureza; o resto sobre a ROL", () => {
    assert.equal(baseDoPercentual(0, linha(COD.RBPF)), COD.ROB);
    assert.equal(baseDoPercentual(0, linha(COD.RLM)), COD.ROB);
    assert.equal(baseDoPercentual(0, linha("IRB.IO.IMPOSTOS_OPERACIONAIS")), COD.ROB);
    assert.equal(baseDoPercentual(0, linha("CPP.MOD.REMUNERACOES_CLT")), COD.RLPF);
    assert.equal(baseDoPercentual(2, linha("CPP.MOD.REMUNERACOES_CLT")), COD.ROL); // Filial: sobre a ROL
    assert.equal(baseDoPercentual(3, linha("CSM.CUSTOS_DE_SERVICOS_MONTAGEM_CSM")), COD.RLM);
    assert.equal(baseDoPercentual(3, linha("CSC.MOD.HORAS_EXTRAS")), COD.RLC);
    assert.equal(baseDoPercentual(0, linha(COD.FRETE)), COD.RLF);
    assert.equal(baseDoPercentual(4, linha("DA.DESPESAS_ADMINISTRATIVAS_DA")), COD.RO);
    assert.equal(baseDoPercentual(0, linha(COD.PRODUCAO)), null);
  });

  it("R$/m³ só no pré-fabricado (produção) e na montagem", () => {
    assert.equal(baseDoUnitario(linha(COD.RLPF)), COD.PRODUCAO);
    assert.equal(baseDoUnitario(linha("CPP.MP.CIMENTO")), COD.PRODUCAO);
    assert.equal(baseDoUnitario(linha(COD.RBM)), COD.MONTAGEM);
    assert.equal(baseDoUnitario(linha("CSM.MOD.MAO_DE_OBRA_DIRETA")), COD.MONTAGEM);
    assert.equal(baseDoUnitario(linha("CSC.MOD.MAO_DE_OBRA_DIRETA")), null);
    assert.equal(baseDoUnitario(linha(COD.RLF)), null);
  });
});

describe("indicadores (aba Realizado (SIG) e Metas, 08/10/2026)", () => {
  it("lista os 110 indicadores, na ordem da planilha", () => {
    assert.equal(INDICADORES.length, 110);
    assert.equal(INDICADORES[0].nome, "Custos de Produção: Matriz (CPP)");
    assert.equal(INDICADORES.at(-1)!.nome, "Repres. do Mix Ampliado nas Vendas");
  });

  it("acumula as razões pela soma dos numeradores sobre a dos denominadores (a média ponderada da planilha)", () => {
    const partes = [
      { num: 70, den: 100 },
      { num: 90, den: 300 },
    ];
    assert.equal(valorDaParte(partes[0]), 0.7);
    assert.equal(acumular({ acumulado: "ACUM" }, partes), 160 / 400);
    assert.equal(acumular({ acumulado: "ACUM" }, [{ num: 10 }, { num: 5 }]), 15);
    assert.equal(acumular({ acumulado: "ATUAL" }, [{ num: 10 }, { num: 5 }]), 5);
    assert.equal(acumular({ acumulado: "ACUM" }, []), null);
  });

  it("calcula da DRE: Custos de Produção da Matriz sobre a Receita Líquida do Pré-Fabricado", () => {
    const cpp = INDICADORES.find((i) => i.nome === "Custos de Produção: Matriz (CPP)")!;
    const dre = (u: number, c: string) => (u === 1 && c === "CPP.CUSTOS_DE_PRODUCAO_PRE_FABRICADOS_CPP" ? 72 : u === 1 && c === COD.RLPF ? 100 : 0);
    assert.deepEqual(cpp.calculo!({ dre, volume: () => 0 }), { num: 72, den: 100 });
    // Sem fonte na ferramenta: listado, sem cálculo.
    assert.equal(INDICADORES.find((i) => i.nome === "Turnover")!.calculo, undefined);
  });
});
