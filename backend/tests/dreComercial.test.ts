import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import { assinaturaDoPreco, interpretarDreComercial, nomesDasObras, usadoNaReceita } from "../src/services/importacoes/dreComercial/leiauteDreComercial.js";

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
    const [ruido] = (interpretarDreComercial(planilha(CABECALHO, linha("L1", "R", 1000, 250.00000000000003))) as { precos: never[] }).precos;
    assert.equal(assinaturaDoPreco(a), assinaturaDoPreco(b));
    assert.equal(assinaturaDoPreco(a), assinaturaDoPreco(ruido));
    assert.notEqual(assinaturaDoPreco(a), assinaturaDoPreco(c));
  });

  it("só entram os preços de pré-fabricado e frete, e ROB e IRB da linha MONTAGEM", () => {
    const ok = (atribuicao: string, linhaTexto: string, departamento: string) => usadoNaReceita({ atribuicao, linhaTexto, departamento });
    assert.equal(ok("Receita Líquida de Frete", "ALVEOLARES", "ROL"), true);
    assert.equal(ok("Impostos Operacionais", "MONTAGEM", "IRB"), true);
    assert.equal(ok("Receita Bruta de Montagem", "MONTAGEM", "ROB"), true);
    assert.equal(ok("Impostos Operacionais", "ESTRUTURA", "IRB"), false);
    assert.equal(ok("Matérias Primas", "ESTRUTURA", "CPP"), false);
  });
});

describe("nomes das obras pela aba Pedidos", () => {
  it("monta CLIENTE | NOME DA OBRA na menor versão, sem repetir e sem os vazios", () => {
    const n = nomesDasObras(
      planilha(
        ["PEDIDOS", null, null, "Obs.: Colar Apenas Valores."],
        ["CÓD.", "PRODUTO / SERVIÇO", "ITEM", "DESCRIÇÃO / VALOR", "FORNECIMENTO", "VENDA", "VERSÃO (N)"],
        ["G1", null, "Nome da Obra", "AMPLIAÇÃO  LOJA ", "Obra", "Global", 0],
        ["G1", null, "Cliente", "ABIMAR", "Obra", "Global", 0],
        ["G1", null, "Cliente", "OUTRO", "Obra", "Global", 1],
        ["L2", null, "Cliente", "MIREIA", "Fab", "Mercantil", 0],
        ["L2", null, "Nome da Obra", "Mireia", "Fab", "Mercantil", 0],
        ["L3", null, "Nome da Obra", 0, "Fab", "Mercantil", 0],
        ["L3", null, "Grupo Cliente", "X", "Fab", "Mercantil", 0],
      ),
    );
    assert.deepEqual([...n], [["G1", "ABIMAR | AMPLIAÇÃO LOJA"], ["L2", "MIREIA"]]);
    assert.equal(nomesDasObras(planilha(["outra coisa"])).size, 0);
  });
});
