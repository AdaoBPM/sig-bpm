import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import { assinaturaDoPreco, interpretarDreComercial } from "../src/services/importacoes/dreComercial/leiauteDreComercial.js";

const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] =>
  linhas.map((celulas, i) => ({ numero: i + 1, celulas }));

const CABECALHO = [
  "CÓD.", "FORNECIMENTO", "VENDA", "VERSÃO", "CONTA CONTÁBIL", "V. TOTAL", "%RL", "V. UNIT.",
  "ETAPA", "UNIDADE", "LINHA", "DEPTO.", "ATRIBUIÇÃO", "VERSÃO (N)",
];
const linha = (obra: string, conta: string, total: ValorCelula, unit: ValorCelula, versao: ValorCelula = 0): ValorCelula[] => [
  obra, "FAB", "MERCANTIL", "VER00", conta, total, 0.5, unit,
  "1", "FILIAL", "Estrutura", "RECEITA OPERACIONAL BRUTA (ROB)", "Receita Bruta do Pré-Fabricado", versao,
];

describe("leitura da DRE do Comercial", () => {
  it("lê os preços, trata '-' como não informado e valida o cabeçalho", () => {
    const l = interpretarDreComercial(
      planilha(["DRE"], CABECALHO, linha("L1", "Receita", 1000, 250), linha("L1", "Frete", 100, "-"), [null]),
    );
    assert.ok(l.ok);
    assert.equal(l.precos.length, 2);
    assert.equal(l.precos[0].valorUnitario?.toFixed(2), "250.00");
    assert.equal(l.precos[0].linhaTexto, "ESTRUTURA");
    assert.equal(l.precos[1].valorUnitario, null);
    assert.equal(l.ignoradas.vazias, 1);

    const semColuna = interpretarDreComercial(planilha(CABECALHO.filter((c) => c !== "V. UNIT.")));
    assert.equal(semColuna.ok, false);
  });

  it("DRE colada duas vezes: a cópia idêntica vira aviso; com valor diferente, rejeição", () => {
    const l = interpretarDreComercial(
      planilha(
        CABECALHO,
        linha("L1", "Receita", 1000, 250),
        linha("L1", "Receita", 1000, 250),
        linha("L1", "Receita", 1200, 300),
      ),
    );
    assert.ok(l.ok);
    assert.equal(l.precos.length, 1);
    assert.equal(l.ignoradas.repetidas, 1);
    assert.deepEqual([...l.obrasRepetidas], [["L1", 1]]);
    assert.deepEqual(l.rejeicoes.map((r) => [r.linha, r.codigo]), [[4, "LINHA_DUPLICADA"]]);
  });

  it("a versão entra na chave: o aditivo não substitui o contrato", () => {
    const l = interpretarDreComercial(planilha(CABECALHO, linha("L1", "Receita", 1000, 250), linha("L1", "Receita", 200, 50, 1)));
    assert.ok(l.ok);
    assert.equal(l.precos.length, 2);
    assert.notEqual(l.precos[0].chave, l.precos[1].chave);
  });

  it("valor não numérico e versão inválida são rejeitados", () => {
    const l = interpretarDreComercial(planilha(CABECALHO, linha("L1", "Receita", "abc", 250), linha("L2", "Receita", 1, 1, "x")));
    assert.ok(l.ok);
    assert.deepEqual(l.rejeicoes.map((r) => r.codigo), ["VALOR_INVALIDO", "VERSAO_INVALIDA"]);
  });

  it("a assinatura muda quando o preço muda, e não depende da escala do decimal", () => {
    const [a] = (interpretarDreComercial(planilha(CABECALHO, linha("L1", "R", 1000, 250))) as { precos: never[] }).precos;
    const [b] = (interpretarDreComercial(planilha(CABECALHO, linha("L1", "R", "1000.00", "250.0"))) as { precos: never[] }).precos;
    const [c] = (interpretarDreComercial(planilha(CABECALHO, linha("L1", "R", 1000, 251))) as { precos: never[] }).precos;
    assert.equal(assinaturaDoPreco(a), assinaturaDoPreco(b));
    assert.notEqual(assinaturaDoPreco(a), assinaturaDoPreco(c));
  });
});
