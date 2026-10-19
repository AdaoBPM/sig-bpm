import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import { lerLotacao } from "../src/services/importacoes/lotacao/leituraLotacao.js";

const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] => linhas.map((celulas, i) => ({ numero: i + 1, celulas }));

// 46023 = 01/01/2026, 46054 = 01/02/2026.
const JAN = 46023;
const FEV = 46054;
const CABECALHO = ["PERÍODO", "CENTRO DE CUSTO", "UNIDADE", "DEPARTAMENTO", "ATRIBUIÇÃO", "CLT", "PJ", "TOTAL"];

describe("quadro de lotação por centro de custo (aba Quadro de Lotação, 19/10/2026)", () => {
  it("lê os centros do mês, com CLT, PJ e o total; ignora os outros meses, os zerados e as linhas vazias", () => {
    const l = lerLotacao(
      planilha(
        CABECALHO,
        [JAN, "ESTRUTURA", "MATRIZ", "PRODUÇÃO", "DIRETA", 39, 0, 39],
        [JAN, "ADM. DE OBRAS", "OBRAS", "OBRAS", "INDIRETA", 4, 5, 9],
        [JAN, "TURN KEY - OBRAS", "OBRAS", "OBRAS", "DIRETA", 0, 0, 0],
        [FEV, "ESTRUTURA", "MATRIZ", "PRODUÇÃO", "DIRETA", 40, 0, 40],
        [null, null, null, null, null, null, null, ""],
      ),
      2026,
      1,
    );
    assert.ok(l.ok);
    assert.deepEqual(
      l.itens.map((i) => [i.centroCusto, i.unidade, i.atribuicao, i.clt, i.pj, i.total, i.linhaArquivo]),
      [
        ["ESTRUTURA", "MATRIZ", "DIRETA", 39, 0, 39, 2],
        ["ADM. DE OBRAS", "OBRAS", "INDIRETA", 4, 5, 9, 3],
      ],
    );
    assert.equal(l.zerados, 1);
    assert.equal(l.foraDoMes, 1);
    assert.deepEqual(l.rejeicoes, []);
  });

  it("rejeita a linha sem centro, com quantidade que não é inteira e com o TOTAL diferente de CLT + PJ", () => {
    const l = lerLotacao(
      planilha(CABECALHO, [JAN, null, "MATRIZ", "", "", 3, 0, 3], [JAN, "VENDAS", "MATRIZ", "", "", 1.5, 0, 1.5], [JAN, "COMPRAS", "MATRIZ", "", "", 3, 0, 4]),
      2026,
      1,
    );
    assert.ok(l.ok);
    assert.equal(l.itens.length, 0);
    assert.deepEqual(
      l.rejeicoes.map((r) => r.codigo),
      ["SEM_CENTRO", "QUANTIDADE_INVALIDA", "TOTAL_DIFERENTE"],
    );
  });

  it("sem as colunas obrigatórias, recusa a aba", () => {
    const l = lerLotacao(planilha(["PERÍODO", "CENTRO DE CUSTO", "TOTAL"]), 2026, 1);
    assert.equal(l.ok, false);
  });
});
