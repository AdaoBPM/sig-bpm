import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { exportarTabela, type TabelaExportada } from "../src/services/exportacoes/exportacaoTabelaService.js";

describe("Exportar das tabelas (30/10/2026)", () => {
  const tabela: TabelaExportada = {
    titulo: "Lançamentos · Controladoria · 09/2026",
    subtitulo: "Os lançamentos digitados",
    colunas: [
      { rotulo: "Nº", tipo: "numero" },
      { rotulo: "Descrição", tipo: "texto" },
      { rotulo: "Valor", tipo: "moeda" },
    ],
    linhas: [
      [{ texto: "1", numero: 1 }, { texto: "Água e saneamento", numero: null }, { texto: "R$ 1.234,56", numero: 1234.56 }],
      [{ texto: "2", numero: 2 }, { texto: "Energia", numero: null }, { texto: "-R$ 10,00", numero: -10 }],
    ],
  };

  it("gera o Excel (um ZIP do OpenXML) com o nome do título, a barra do mês em hífen", () => {
    const x = exportarTabela(tabela, "xlsx", "Teste");
    assert.equal(x.nomeArquivo, "Lançamentos · Controladoria · 09-2026.xlsx");
    assert.equal(Buffer.from(x.conteudo.slice(0, 2)).toString("latin1"), "PK");
  });

  it("gera o PDF, com uma página para poucas linhas e mais páginas para muitas", () => {
    const pdf = Buffer.from(exportarTabela(tabela, "pdf", "Teste").conteudo).toString("latin1");
    assert.ok(pdf.startsWith("%PDF"));
    assert.equal((pdf.match(/\/Type\s*\/Page\b/g) ?? []).length, 1);
    const muitas = { ...tabela, linhas: Array.from({ length: 200 }, (_, i) => tabela.linhas[i % 2]) };
    const grande = Buffer.from(exportarTabela(muitas, "pdf", "Teste").conteudo).toString("latin1");
    assert.ok((grande.match(/\/Type\s*\/Page\b/g) ?? []).length > 1);
  });
});
