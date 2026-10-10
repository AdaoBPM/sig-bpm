import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Prisma } from "../src/generated/prisma/client.js";
import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import {
  DEFINICOES_LISTAS,
  linhaDaPeca,
  linhaDoGrupo,
  volumeAdotado,
} from "../src/services/importacoes/listas/definicoesListas.js";
import { destinoDaFinalidade, destinoDoAcompanhamento } from "../src/services/importacoes/listas/destinosVolume.js";
import { itemDoRegistro } from "../src/services/importacoes/listas/processarLista.js";
import { somarTotais } from "../src/services/volumes/totaisOperacao.js";

const D = (v: number | string) => new Prisma.Decimal(v);
const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] =>
  linhas.map((celulas, i) => ({ numero: i + 1, celulas }));

// 46023 = 01/01/2026, 46054 = 01/02/2026.
const JAN = 46023;
const FEV = 46054;

describe("regras das colunas calculadas", () => {
  it("volume adotado da expedição: informado, seção × comprimento ou peso / 2.500", () => {
    assert.equal(volumeAdotado(D(2.5), "ES26-8", D(1000)).toFixed(4), "2.5000");
    // (26 + 0,5) / 100, ao quadrado, vezes 8 m
    assert.equal(volumeAdotado(D(0), "ES26-8", D(1000)).toFixed(4), "0.5618");
    assert.equal(volumeAdotado(D(0), "VC-X", D(5000)).toFixed(4), "2.0000");
    assert.equal(volumeAdotado(D(0), "SEM TRACO", D(2500)).toFixed(4), "1.0000");
  });

  it("linha da expedição pelo nome da peça e da montagem pelo grupo", () => {
    assert.deepEqual(["ESC-1", "ES26-8", "LAB15", "PA20", "VC-1028"].map(linhaDaPeca), [
      "ESTRUTURA", "ESTACAS", "ALVEOLARES", "ALVEOLARES", "ESTRUTURA",
    ]);
    assert.deepEqual(["LABN", "TB", "ESC", "ESD", "P"].map(linhaDoGrupo), [
      "ALVEOLARES", "ALVEOLARES", "ESTRUTURA", "ESTACAS", "ESTRUTURA",
    ]);
  });

  it("destinos da metalurgia e do acompanhamento", () => {
    assert.equal(destinoDaFinalidade("Inserto Metálico"), "MATRIZ");
    assert.equal(destinoDaFinalidade("MANUTENÇÃO: OBRAS"), "MONTAGEM");
    assert.equal(destinoDaFinalidade("INVESTIMENTO"), null);
    assert.equal(destinoDaFinalidade("NOVA FINALIDADE"), undefined);
    assert.equal(destinoDoAcompanhamento("SAC"), "MONTAGEM");
    assert.equal(destinoDoAcompanhamento("FUNDAÇÃO"), "COMPLEMENTAR");
  });
});

describe("leitura das listas", () => {
  it("projetos: só o mês da competência; linha e venda global saem da unidade, do produto e da sigla", () => {
    const leitura = DEFINICOES_LISTAS.PROJETO.interpretar(
      planilha(
        ["Unidade", "Obra", "Sigla Obra", "Data", "Nome Peça", "Volume (m³)", "Produto"],
        ["Unidade 01", "ABIMAR", "G3168", JAN + 3.125, "P-1", 2.5, "PILAR"],
        ["Unidade 02", "SCHROEDER", "E862204", JAN + 10, "ESD35-8", 1, "ESTACA"],
        ["Unidade 02", "LOJA", "L866004", JAN + 11, "LAB15", 3, "LAJE ALVEOLAR"],
        ["Unidade 01", "ABIMAR", "G3168", FEV, "P-2", 9, "PILAR"],
        [null, null, null, null, null, null, null],
        ["Unidade 09", "X", "G1", JAN, "P", 1, "PILAR"],
      ),
      2026,
      1,
    );
    assert.ok(leitura.ok);
    assert.deepEqual(leitura.registros.map((r) => r.linha?.codigo), ["ESTRUTURA", "ESTACAS", "ALVEOLARES"]);
    assert.deepEqual(leitura.ignoradas, { vazias: 1, outrosMeses: 1, semEfeito: 0 });
    assert.equal(leitura.rejeicoes[0].codigo, "UNIDADE_INVALIDA");

    // Projetos liberados só contam venda global (sigla com G).
    const totais = somarTotais(leitura.registros.map((r) => itemDoRegistro("PROJETO", r)), ["PROJETO"]);
    assert.deepEqual(
      totais.map((t) => [t.codigo, t.quantidade.toFixed(3)]),
      [["PROJETOS_MATRIZ", "2.500"], ["PROJETOS_FILIAL", "0.000"]],
    );
  });

  it("metalurgia: lê a coluna do mês e confere com os totais da própria aba", () => {
    const leitura = DEFINICOES_LISTAS.PRODUCAO_METALURGIA.interpretar(
      planilha(
        ["RELATÓRIO DE PRODUÇÃO MENSAL POR FINALIDADE (kg)"],
        ["FINALIDADE", JAN, FEV],
        ["TOTAL: GERAL", 30, 0],
        ["TOTAL: MATRIZ", 99, 0],
        ["INSERTO METÁLICO", 10, 0],
        ["MANUTENÇÃO: MATRIZ", 5, 0],
        ["FERRAGEM", 15, 0],
      ),
      2026,
      1,
    );
    assert.ok(leitura.ok);
    assert.equal(leitura.registros.length, 3);
    assert.equal(leitura.avisos.length, 1);
    assert.match(leitura.avisos[0], /TOTAL: MATRIZ da aba é 99.00 kg e a soma das finalidades dá 15.00 kg/);
  });

  it("recusa a lista sem as colunas obrigatórias e a matriz sem o mês", () => {
    const semColuna = DEFINICOES_LISTAS.MONTAGEM.interpretar(planilha(["Data", "Obra"]), 2026, 1);
    assert.equal(semColuna.ok, false);
    const semMes = DEFINICOES_LISTAS.PRODUCAO_ARMADURA.interpretar(planilha(["Unidade/Linha", FEV], ["Matriz (kg)", 1]), 2026, 1);
    assert.equal(semMes.ok, false);
    assert.match(!semMes.ok ? semMes.motivo : "", /jan\/2026.*fev\/2026/);
  });
});

describe("armadura e metalurgia com as colunas Linha e Und. (09/10/2026)", () => {
  it("armadura: Unidade, Linha e Und.; a linha diz o destino do rateio, como as categorias antigas", () => {
    const l = DEFINICOES_LISTAS.PRODUCAO_ARMADURA.interpretar(
      planilha(
        ["Unidade", "Linha", "Und.", JAN, FEV],
        ["MATRIZ", "ESTRUTURA", "kg", 1, 2],
        ["SERVIÇOS", "MONTAGEM", "kg", 3, 4],
        ["SERVIÇOS", "TURN-KEY", "kg", 5, 6],
      ),
      2026,
      2,
    );
    assert.ok(l.ok);
    assert.deepEqual(
      l.registros.map((r) => [r.unidade, r.linha?.codigo, String(r.campos.categoria), r.quantidade.toNumber()]),
      [[1, "ESTRUTURA", "ESTRUTURA", 2], [3, "MONTAGEM", "MONTAGEM", 4], [3, "TURN-KEY", "TURN-KEY", 6]],
    );
    const totais = somarTotais(l.registros.map((r) => itemDoRegistro("PRODUCAO_ARMADURA", r)), ["PRODUCAO_ARMADURA"]);
    assert.deepEqual(
      totais.map((t) => [t.codigo, t.quantidade.toNumber()]),
      [["ARMADURA_MATRIZ", 2], ["ARMADURA_FILIAL", 0], ["ARMADURA_MONTAGEM", 4], ["ARMADURA_COMPLEMENTAR", 6]],
    );
  });

  it("metalurgia: a coluna LINHA vira a linha do registro; o investimento por unidade entra na conta da unidade", () => {
    const l = DEFINICOES_LISTAS.PRODUCAO_METALURGIA.interpretar(
      planilha(
        ["FINALIDADE", "LINHA", JAN],
        ["TOTAL: GERAL", "-", 10],
        ["INSERTO METÁLICO", "ESTRUTURA", 7],
        ["ESTRUTURA METÁLICA", "METÁLICA", 1],
        ["INVESTIMENTO: MATRIZ", "ESTRUTURA", 2],
      ),
      2026,
      1,
    );
    assert.ok(l.ok);
    assert.deepEqual(l.registros.map((r) => [String(r.campos.finalidade), r.linha?.codigo ?? null, r.unidade]), [
      ["INSERTO METÁLICO", "ESTRUTURA", 1],
      ["ESTRUTURA METÁLICA", "METÁLICA", 3],
      ["INVESTIMENTO: MATRIZ", "ESTRUTURA", 1],
    ]);
    assert.equal(destinoDaFinalidade("INVESTIMENTO: MATRIZ"), "MATRIZ");
    assert.equal(destinoDaFinalidade("INVESTIMENTO: OBRAS"), "MONTAGEM");
    assert.equal(destinoDaFinalidade("INVESTIMENTO"), null);
    assert.deepEqual(l.avisos ?? [], []);
  });
});

describe("abas (Resumo) no lugar das (Lista) (09/10/2026)", () => {
  it("projetos: o resumo por obra e linha; a aba com Data continua lida como lista", () => {
    const resumo = DEFINICOES_LISTAS.PROJETO.interpretar(
      planilha(
        ["Período", "Unidade", "Sigla Obra", "Obra", "Venda", "Linha", "Grupo", "Seção", "Volume (m³)", "Comprimento (m)", "Quantidade"],
        [JAN, "Unidade 01", "G3171", "NAIJUS", "GLOBAL", "ESTRUTURA", "ESC", "20", 229.226, 1015.34, 476],
        [FEV, "Unidade 02", "G3168", "ABIMAR", "GLOBAL", "ALVEOLARES", "LABN", "LABN25.20", 2.68, 20.16, 3],
      ),
      2026,
      1,
    );
    assert.ok(resumo.ok);
    assert.deepEqual(
      resumo.registros.map((r) => [r.obra?.codigo, r.unidade, r.linha?.codigo, r.quantidade.toNumber(), r.campos.grupo]),
      [["G3171", 1, "ESTRUTURA", 229.226, "ESC"]],
    );
  });

  it("produção: o grupo da peça (E, ES, ESD) e a seção vão para o preço da estaca", () => {
    const l = DEFINICOES_LISTAS.PRODUCAO.interpretar(
      planilha(
        ["Período", "Unidade", "Obra", "Nome da Obra", "Linha", "Grupo", "Seção", "Volume (m³)", "Compr. (m)", "Quantidade", "Etiqueta"],
        [FEV, "Unidade 02", "E862204", "SCHOROEDER - PONTE", "ESTACAS", "ESD", "35,0X35,0", 58.8, 480, 60, "02/2026.E862204.ESTACAS(ESD35-8)"],
      ),
      2026,
      2,
    );
    assert.ok(l.ok);
    assert.deepEqual([l.registros[0].campos.grupo, l.registros[0].campos.secao, l.registros[0].campos.quantidadePecas], ["ESD", "35,0X35,0", 60]);
  });

  it("expedição: a peça da estaca, sem peça nas demais linhas; o volume é o adotado", () => {
    const l = DEFINICOES_LISTAS.EXPEDICAO.interpretar(
      planilha(
        ["Período", "Unidade", "Obra", "Nome da Obra", "Linha", "Peça", "Volume (m³)", "Quantidade"],
        [JAN + 0.125, "Unidade 01", "G3168", "ABIMAR", "ESTRUTURA", "-", 175.4808, 131],
        [JAN + 0.125, "Unidade 02", "E826405", "VENTISOL", "ESTACAS", "ES26", 108.7083, 153],
      ),
      2026,
      1,
    );
    assert.ok(l.ok);
    assert.deepEqual(l.registros.map((r) => [r.unidade, r.linha?.codigo, r.campos.nomePeca, r.quantidade.toNumber()]), [
      [1, "ESTRUTURA", null, 175.4808],
      [2, "ESTACAS", "ES26", 108.7083],
    ]);
  });
});

describe("Código da linha de obra (cadastro Linhas)", () => {
  it("lê a etapa ou a linha com espaço, hífen ou minúsculas como o código do cadastro", async () => {
    const { codigoDaLinhaDeObra } = await import("../src/services/importacoes/listas/leituraListas.js");
    assert.equal(codigoDaLinhaDeObra("TURN KEY"), "TURN-KEY");
    assert.equal(codigoDaLinhaDeObra("Turn-Key"), "TURN-KEY");
    assert.equal(codigoDaLinhaDeObra(" turn - key "), "TURN-KEY");
    assert.equal(codigoDaLinhaDeObra("Fundação"), "FUNDAÇÃO");
    assert.equal(codigoDaLinhaDeObra("SAC"), "SAC");
  });
});
