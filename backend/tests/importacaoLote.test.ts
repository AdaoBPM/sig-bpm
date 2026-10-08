import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gerarXlsx, type AbaEscrita } from "../src/lib/xlsxEscrita.js";
import { analisarArquivo } from "../src/services/importacoes/analiseArquivo.js";

const aba = (nome: string, linhas: Array<Array<string | number | null>>): AbaEscrita => ({
  nome,
  larguras: linhas[0]?.map(() => 12) ?? [12],
  linhas: linhas.map((l) => l.map((valor) => ({ valor }))),
});

// 46235 = 01/08/2026 (serial do Excel).
const arquivo = gerarXlsx([
  aba("Resumo", [["qualquer coisa"]]),
  aba("Acompanhamentos", [
    ["PERÍODO", "PROJETO", "OBRA", "ETAPA", "DIAS DE ACOMP."],
    [46235, "G1", "OBRA 1", "MONTAGEM", 3],
  ]),
  aba("Medições", [["SEM", "AS", "COLUNAS"]]),
  aba("Estoque (2025)", [["OBRA", "LINHA", "VOLUME (M³)", "TOTAL FISCAL (R$)"]]),
]);

describe("importação em lote: leitura prévia das abas", () => {
  it("associa as abas aos tipos pelo nome e confere a estrutura de cada uma", () => {
    const r = analisarArquivo(arquivo, { ano: 2026, mes: 8, fechada: false }, () => true);
    const de = (nome: string) => r.abas.find((a) => a.aba === nome);
    assert.equal(de("Acompanhamentos")?.tipo, "ACOMPANHAMENTO");
    assert.equal(de("Acompanhamentos")?.situacao, "PRONTA");
    assert.equal(de("Acompanhamentos")?.registros, 1);
    // Aba com o nome certo e as colunas erradas: inválida, com o motivo.
    assert.equal(de("Medições")?.situacao, "INVALIDA");
    assert.ok(de("Medições")?.mensagem);
    // O saldo inicial só entra em 12/2025.
    assert.equal(de("Estoque (2025)")?.situacao, "IGNORADA");
    assert.deepEqual(r.outras, ["Resumo"]);
  });

  it("sem registros do mês, a aba é inválida; em mês fechado, só o balancete entra", () => {
    const julho = analisarArquivo(arquivo, { ano: 2026, mes: 7, fechada: false }, () => true);
    assert.equal(julho.abas.find((a) => a.aba === "Acompanhamentos")?.situacao, "INVALIDA");
    const fechada = analisarArquivo(arquivo, { ano: 2026, mes: 8, fechada: true }, () => true);
    assert.equal(fechada.abas.find((a) => a.aba === "Acompanhamentos")?.situacao, "IGNORADA");
  });

  it("respeita o recorte por setor", () => {
    const r = analisarArquivo(arquivo, { ano: 2026, mes: 8, fechada: false }, (tipo) => tipo !== "ACOMPANHAMENTO");
    assert.equal(r.abas.find((a) => a.aba === "Acompanhamentos")?.situacao, "IGNORADA");
  });
});
