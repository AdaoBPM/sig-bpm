import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lerAba } from "../src/lib/xlsx.js";
import { gerarXlsx, type AbaEscrita } from "../src/lib/xlsxEscrita.js";
import { analisarArquivo, type Competencia, type FontesAnalise } from "../src/services/importacoes/analiseArquivo.js";

const aba = (nome: string, linhas: Array<Array<string | number | null>>): AbaEscrita => ({
  nome,
  larguras: linhas[0]?.map(() => 12) ?? [12],
  linhas: linhas.map((l) => l.map((valor) => ({ valor }))),
});

// Datas como serial do Excel: 46054 = 01/02/2026, 46082 = 01/03/2026, 46113 = 01/04/2026, 46235 = 01/08/2026.
const arquivo = gerarXlsx([
  aba("Resumo", [["qualquer coisa"]]),
  aba("Acompanhamentos", [
    ["PERÍODO", "PROJETO", "OBRA", "ETAPA", "DIAS DE ACOMP."],
    [46054, "G1", "OBRA 1", "MONTAGEM", 1],
    [46082, "G1", "OBRA 1", "MONTAGEM", 2],
    [46113, "G1", "OBRA 1", "MONTAGEM", 4],
    [46235, "G1", "OBRA 1", "MONTAGEM", 3],
  ]),
  aba("Medições", [["SEM", "AS", "COLUNAS"]]),
  aba("Estoque (2025)", [
    ["OBRA", "LINHA", "VOLUME (M³)", "TOTAL FISCAL (R$)"],
    ["OBRA 1", "ESTRUTURA", 10, 15000],
  ]),
]);
const linhasDoArquivo = lerAba(arquivo, () => "Acompanhamentos").linhas;

// O ano de 2026 até agosto: fevereiro fechado, os demais em conferência.
const meses: Competencia[] = Array.from({ length: 8 }, (_, i) => ({ id: `c${i + 1}`, ano: 2026, mes: i + 1, status: i === 1 ? "FECHADA" : "EM_CONFERENCIA" }));
const agosto = meses[7];
const fontes: FontesAnalise = {
  doAno: async (o) => meses.filter((c) => c.mes <= o.mes),
  primeira: async () => meses[0],
  // Em vigor: abril igual ao arquivo; os demais meses, outro conteúdo (ou nada).
  assinaturaEmVigor: async (_tipo, c, ler) => (c.mes === 4 ? (ler(linhasDoArquivo, c.ano, c.mes)?.assinatura ?? null) : "outro"),
};
const todos = () => true;

describe("importação em lote: prévia das abas, mês a mês", () => {
  it("associa as abas pelo nome e decide cada mês pelo conteúdo em vigor", async () => {
    const r = await analisarArquivo(arquivo, agosto, todos, fontes);
    const acomp = r.abas.find((a) => a.aba === "Acompanhamentos")!;
    assert.equal(acomp.tipo, "ACOMPANHAMENTO");
    assert.equal(acomp.situacao, "ANALISADA");
    const acao = Object.fromEntries(acomp.meses.map((m) => [m.anoMes, m.acao]));
    assert.deepEqual(acao, {
      "2026-02": "FECHADA", // anterior já fechado: só avisa
      "2026-03": "IMPORTAR", // anterior aberto, diferente: importa
      "2026-04": "SEM_MUDANCA", // igual ao em vigor
      "2026-08": "IMPORTAR", // o mês do envio
    });
    assert.equal(acomp.meses.find((m) => m.anoMes === "2026-08")?.atual, true);
    // Aba com o nome certo e as colunas erradas: inválida, com o motivo.
    assert.equal(r.abas.find((a) => a.aba === "Medições")?.situacao, "INVALIDA");
    // O saldo inicial vai sempre para o primeiro mês da ferramenta, de qualquer mês do envio.
    const inicial = r.abas.find((a) => a.aba === "Estoque (2025)")!;
    assert.equal(inicial.tipo, "ESTOQUE_INICIAL");
    assert.deepEqual(
      inicial.meses.map((m) => [m.anoMes, m.acao, m.atual]),
      [["2026-01", "IMPORTAR", false]],
    );
    assert.deepEqual(r.outras, ["Resumo"]);
  });

  it("em competência fechada, só o balancete; respeita o recorte por setor", async () => {
    const fechada = await analisarArquivo(arquivo, { ...agosto, status: "FECHADA" }, todos, fontes);
    assert.equal(fechada.abas.find((a) => a.aba === "Acompanhamentos")?.situacao, "IGNORADA");
    const recorte = await analisarArquivo(arquivo, agosto, (tipo) => tipo !== "ACOMPANHAMENTO", fontes);
    assert.equal(recorte.abas.find((a) => a.aba === "Acompanhamentos")?.situacao, "IGNORADA");
  });
});
