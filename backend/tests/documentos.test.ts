import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import { lerDocumentos } from "../src/services/importacoes/documentos/leituraDocumentos.js";

const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] => linhas.map((celulas, i) => ({ numero: i + 1, celulas }));
// 01/03/2026 e 01/02/2026 em série do Excel (com a hora, como no arquivo).
const MAR = 46082.125;
const FEV = 46054.125;

describe("leitura das requisições e das notas fiscais", () => {
  it("requisições: só o mês, pela coluna PERÍODO; a conta como texto; sem conta, rejeição", () => {
    const l = lerDocumentos(
      "REQUISICOES",
      planilha(
        ["IDENTIFICADOR", "NM_TIPO", "FILIAL", "CENTRO_CUSTO", "NOME_CENTRO_CUSTO", "CONTA_CONTABIL", "DESCRIÇÃO_ITEM", "QUANTIDADE", "VLR_UNIT", "VLR_TOTAL", "PERÍODO"],
        [1, "Baixa", 1, "1.11.00000001", "ESTRUTURA", 4831, "LUVA", 2, 1.5, 3, MAR],
        [2, "Baixa", 1, "1.11.00000001", "ESTRUTURA", 4831, "LUVA", 1, 1.5, 1.5, FEV],
        [3, "Baixa", 1, "1.11.00000001", "ESTRUTURA", null, "SEM CONTA", 1, 1, 1, MAR],
      ),
      2026,
      3,
    );
    assert.ok(l.ok);
    assert.equal(l.itens.length, 1);
    assert.equal(l.itens[0].contaContabil, "4831");
    assert.equal(l.itens[0].identificador, "1");
    assert.equal(l.itens[0].valorTotal.toFixed(2), "3.00");
    assert.equal(l.itens[0].nomeCentroCusto, "ESTRUTURA");
    assert.equal(l.foraDoMes, 1);
    assert.deepEqual(l.rejeicoes.map((r) => r.codigo), ["SEM_CONTA"]);
  });

  it("notas fiscais: o fornecedor (FANTASIA), a NF e o centro (CENTRO DE CUSTO)", () => {
    const l = lerDocumentos(
      "NOTAS_FISCAIS",
      planilha(["NF", "CENTRO_CUSTO", "CENTRO DE CUSTO", "FILIAL", "FANTASIA", "DESCRICAO_ITEM", "QTD", "VLR_TOTAL", "CONTA_CONTABIL", "PERÍODO"], [961, "1.11.00000005", "ACABAMENTO", 1, "CONFEREL", "SERVICO", 1, 124, 4593, MAR]),
      2026,
      3,
    );
    assert.ok(l.ok);
    assert.equal(l.itens[0].numero, "961");
    assert.equal(l.itens[0].fornecedor, "CONFEREL");
    assert.equal(l.itens[0].nomeCentroCusto, "ACABAMENTO");
  });

  it("sem as colunas obrigatórias, recusa", () => {
    assert.equal(lerDocumentos("REQUISICOES", planilha(["IDENTIFICADOR", "VLR_TOTAL"]), 2026, 3).ok, false);
  });
});
