import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import {
  DEFINICOES_LISTAS_RECEITA,
  linhaDaDevolucao,
  linhaDaSaida,
} from "../src/services/importacoes/listas/definicoesListasReceita.js";

const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] => linhas.map((celulas, i) => ({ numero: i + 1, celulas }));
// 46034 = 12/01/2026; 46066 = 13/02/2026.
const JAN = 46034.125;
const FEV = 46066.125;

describe("regras das colunas calculadas das listas da receita", () => {
  it("linha da devolução: LMP, ESC ou Filial 1 é ESTRUTURA; LUV e E… estacas; L, PA, TB alveolares", () => {
    assert.equal(linhaDaDevolucao("PM-602 - G906501", 1), "ESTRUTURA");
    assert.equal(linhaDaDevolucao("ESC-10", 2), "ESTRUTURA");
    assert.equal(linhaDaDevolucao("LUV-23 LUVA", 2), "ESTACAS");
    assert.equal(linhaDaDevolucao("ES26-8", 2), "ESTACAS");
    assert.equal(linhaDaDevolucao("L-1007I", 2), "ALVEOLARES");
    assert.equal(linhaDaDevolucao("TB-20", 2), "ALVEOLARES");
    assert.equal(linhaDaDevolucao("PM-602", 2), null);
  });

  it("linha da saída: luva é estaca, sucata é da metalúrgica, o resto fica de fora", () => {
    assert.equal(linhaDaSaida("LUV-23 - LUVA METALICA"), "ESTACAS");
    assert.equal(linhaDaSaida("Sucata de aço"), "METALÚRGICA");
    assert.equal(linhaDaSaida("CIMENTO"), null);
  });
});

describe("leitura das listas da receita", () => {
  const DEV = ["Data emissão", "Nota fiscal", "Projeto", "Filial", "Descrição", "Quantidade", "Vlr. total", "Movimento", "Vlr. ICMS", "Vlr. PIS", "Vlr. COFINS"];

  it("devolução: créditos são ICMS + PIS + COFINS, zero em obra global; sem projeto fica de fora", () => {
    const l = DEFINICOES_LISTAS_RECEITA.DEVOLUCAO.interpretar(
      planilha(
        DEV,
        [JAN, "1", "L866004", 2, "L-10", 3, 1000, "1.2.18", 100, 10, 50],
        [JAN, "2", "G3168", "1", "P-82", 1, 500, "1.2.20", 90, 9, 45],
        [JAN, "3", null, 2, "L-10", 1, 200, "1.2.18", 1, 1, 1],
        [FEV, "4", "L866004", 2, "L-10", 1, 300, "1.2.18", 1, 1, 1],
      ),
      2026,
      1,
    );
    assert.ok(l.ok);
    assert.deepEqual(l.registros.map((r) => [r.linha?.codigo, r.unidade, String(r.campos.creditos)]), [
      ["ALVEOLARES", 2, "160"],
      // Filial como texto "1": a ferramenta lê como número (na planilha, "1"=1 é falso).
      ["ESTRUTURA", 1, "0"],
    ]);
    assert.deepEqual(l.ignoradas, { vazias: 0, outrosMeses: 1, semEfeito: 1 });
  });

  it("saída: sucata entra sem projeto e sem créditos", () => {
    const l = DEFINICOES_LISTAS_RECEITA.SAIDA.interpretar(
      planilha(
        ["DATA_EMISSAO", "NF", "PROJETO", "FILIAL", "DESCRICAO_ITEM", "QTD", "VLR_TOTAL", "MOVIMENTO", "ICMS_VLR", "PIS_VLR", "COFINS_VLR"],
        [JAN, "1", null, 1, "SUCATA DE ACO", 100, 800, "2.2.02", 10, 1, 5],
        [JAN, "2", "E886402", 2, "LUV-23", 15, 2205, "2.2.02", 264.6, 32.02, 147.47],
        [JAN, "3", null, 2, "LUV-23", 1, 10, "2.2.02", 1, 1, 1],
      ),
      2026,
      1,
    );
    assert.ok(l.ok);
    assert.deepEqual(l.registros.map((r) => [r.linha?.codigo, r.unidade, r.obra?.codigo ?? null, String(r.campos.creditos)]), [
      ["METALÚRGICA", 1, null, "0"],
      ["ESTACAS", 2, "E886402", "444.09"],
    ]);
    assert.equal(l.ignoradas.semEfeito, 1);
  });

  it("medição: a quantidade é a diferença de execução e o valor medido, ela vezes o Fat. BPM", () => {
    const l = DEFINICOES_LISTAS_RECEITA.MEDICAO.interpretar(
      planilha(
        ["Período", "Projeto", "Cliente", "Obra", "Lançamento", "Linha", "Tipo de Faturamento", "Fat. BPM (R$)", "Exec. (Ant.)", "Exec. (Atual)"],
        [46023, "G3168", "ABIMAR", "ABIMAR", "PADRÃO", "Montagem", "Execução de Serviços", 1011520, 0.75, 0.9],
      ),
      2026,
      1,
    );
    assert.ok(l.ok);
    const [r] = l.registros;
    assert.equal(r.linha?.codigo, "MONTAGEM");
    assert.equal(r.unidade, 3);
    assert.equal(r.quantidade.toFixed(2), "0.15");
    assert.equal((r.campos.valorMedido as { toFixed: (n: number) => string }).toFixed(2), "151728.00");
  });
});
