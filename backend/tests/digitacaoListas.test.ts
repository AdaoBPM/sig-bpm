import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DigitacaoInvalida, lerDigitado } from "../src/services/listas/digitacaoListas.js";

describe("digitação das listas: mesmas regras da importação", () => {
  it("expedição com volume zero usa a seção e o comprimento da peça", () => {
    const r = lerDigitado("EXPEDICAO", { Obra: "G1", "Nome da Peça": "ES26-8", "Peso (kg)": "1000", "Volume (m³)": "0" }, 2026, 2);
    assert.equal(r.quantidade.toFixed(4), "0.5618");
    assert.equal(r.linha?.codigo, "ESTACAS");
    assert.equal(r.unidade, 2);
    assert.equal((r.campos.data as Date).toISOString().slice(0, 10), "2026-02-01");
  });

  it("pista entra como um registro da linha escolhida, na Filial", () => {
    const r = lerDigitado("PRODUCAO_PISTA", { Linha: "ALVEOLARES", Pistas: "3" }, 2026, 1);
    assert.equal(r.linha?.codigo, "ALVEOLARES");
    assert.equal(r.quantidade.toString(), "3");
    assert.equal(r.unidade, 2);
  });

  it("projeto na Unidade 02 com produto de estaca é estaca", () => {
    const r = lerDigitado("PROJETO", { Unidade: "Unidade 02", "Sigla Obra": "G9", Produto: "ESTACA", "Volume (m³)": "1,5" }, 2026, 1);
    assert.equal(r.linha?.codigo, "ESTACAS");
    assert.equal(r.quantidade.toString(), "1.5");
  });

  it("recusa campo obrigatório vazio, opção fora da lista e valor zerado", () => {
    assert.throws(() => lerDigitado("MONTAGEM", { Obra: "G1", Grupo: "", "Volume (m³)": "1" }, 2026, 1), DigitacaoInvalida);
    assert.throws(() => lerDigitado("PRODUCAO_METALURGIA", { FINALIDADE: "OUTRA", Peso: "1" }, 2026, 1), /não é uma opção válida/);
    assert.throws(() => lerDigitado("PRODUCAO_PISTA", { Linha: "ESTACAS", Pistas: "0" }, 2026, 1), /zerados/);
  });
});
