import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LinhaPlanilha, ValorCelula } from "../src/lib/xlsx.js";
import { mesesAcima, totaisDaDRE } from "../src/services/cenarios/comparativoCenario.js";
import { classificar } from "../src/services/cenarios/indicadoresDoCenario.js";
import { acharAba, lerAbaDRE, lerAbaMetas } from "../src/services/cenarios/leituraCenario.js";
import { diasUteis, pascoa } from "../src/services/cenarios/calendario.js";
import { calcularTabela, linhasDaTabela } from "../src/services/cenarios/premissasCenario.js";
import { ESTRUTURA_INICIAL_INDICADORES } from "../src/services/relatorios/estruturaInicialIndicadores.js";

const planilha = (...linhas: ValorCelula[][]): LinhaPlanilha[] => linhas.map((celulas, i) => ({ numero: i + 1, celulas }));
const ESTRUTURA = [
  { id: "a", codigo: "RO", descricao: "RECEITA OPERACIONAL LÍQUIDA (ROL)" },
  { id: "b", codigo: "P.PISTAS", descricao: "Produção do Pré-Fabricado (pistas)" },
  { id: "c", codigo: "CPP.MOD", descricao: "Mão de Obra Direta" },
  { id: "d", codigo: "CSM.MOD", descricao: "Mão de Obra Direta" },
];

describe("leitura do cenário sintético", () => {
  it("acha as abas pelo nome, sem confundir com as (R) e (O)", () => {
    assert.equal(acharAba(["Consolidado (R)", "Desp. +Extra", "Extra RN"], ["Desp.+Extra"]), "Desp. +Extra");
    assert.equal(acharAba(["Consolidado (R)"], ["Consolidado"]), null);
  });

  it("liga as linhas da DRE pela descrição, na ordem, e lê os meses (a primeira coluna de cada mês)", () => {
    const aba = lerAbaDRE(
      0,
      "Consolidado",
      planilha(
        ["PROJEÇÃO: CONSOLIDADO", "JAN/26", "%", "FEV/26", "%", "FEV/26"],
        ["RECEITA OPERACIONAL LÍQUIDA (ROL)", 100, 1, 200, 1, 999],
        ["Produção do Pré-Fabricado (pst)", 5, "-", "-", "-", 0],
        ["Mão de Obra Direta", 10, 0.1, 20, 0.1, 0],
        ["Mão de Obra Direta", 30, 0.3, 40, 0.2, 0],
        ["DESPESAS + EXTRA OPERACIONAL (DEO)", 7, 0, 7, 0, 0],
        ["Linha Nova", 1, 0, 0, 0, 0],
      ),
      ESTRUTURA,
    );
    assert.ok(aba);
    assert.equal(aba.ano, 2026);
    assert.equal(aba.meses, 2);
    const v = (id: string, mes: number) => aba.valores.find((x) => x.linhaDREId === id && x.mes === mes)?.valor;
    assert.equal(v("a", 2), 200);
    assert.equal(v("b", 1), 5);
    assert.equal(v("b", 2), undefined);
    assert.equal(v("c", 1), 10);
    assert.equal(v("d", 2), 40);
    assert.deepEqual(aba.semPar, ["7: Linha Nova"]);
  });

  it("aba com o nome de uma unidade que não é DRE fica de fora", () => {
    assert.equal(lerAbaDRE(3, "Serviços", planilha(["GRUPO", "INDICADOR", "JAN/2026"], ["Serviços", "Rendimento: Montagem", 1]), ESTRUTURA), null);
  });

  it("lê as metas pelo nome do indicador, com o apelido do quadro de lotação", () => {
    const m = lerAbaMetas(
      "Metas",
      planilha(["GRUPO", "INDICADOR", "TIPO", "JAN/2026", "FEV/2026", "ACUM. (O)"], ["x", "Turnover", "↓", 0.02, 0.03, 0.05], ["x", "Quadro de Lotação", "=", 300, null, 300], ["x", "Outro", "=", 1, 1, 1]),
      ["Turnover", "Quadro de Lotação Total"],
    );
    assert.ok(m);
    assert.equal(m.ano, 2026);
    assert.deepEqual(m.valores, [
      { nome: "Turnover", mes: 1, valor: 0.02 },
      { nome: "Turnover", mes: 2, valor: 0.03 },
      { nome: "Quadro de Lotação Total", mes: 1, valor: 300 },
    ]);
    assert.deepEqual(m.ignorados, ["Outro"]);
  });

  it("classifica os indicadores: da DRE, manuais, calculados (eficiências) e importados", () => {
    const classe = new Map(ESTRUTURA_INICIAL_INDICADORES.map((i) => [i.nome, classificar(i)]));
    assert.equal(classe.get("Custos de Produção: Matriz (CPP)"), "RESULTADO");
    assert.equal(classe.get("Quadro de Lotação: MO Direta Matriz"), "MANUAL");
    assert.equal(classe.get("Venda: Total"), "MANUAL");
    assert.equal(classe.get("Eficiência da Produção: MO Direta Matriz"), "CALCULADO");
    assert.equal(classe.get("Eficiência da Operação: MO Geral Total"), "CALCULADO");
    assert.equal(classe.get("Liberação de Projetos: Total"), "IMPORTADO");
    assert.equal(classe.get("Atingimento da MC Acumulada"), "IMPORTADO");
    const contagem = [...classe.values()].reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {});
    assert.deepEqual(contagem, { RESULTADO: 53, MANUAL: 33, CALCULADO: 25, IMPORTADO: 7 });
  });
});

describe("comparativo entre cenários", () => {
  const linha = (codigo: string, tipo: "SECAO" | "ITEM" | "SUBTOTAL" | "TOTAL", descricao = codigo) => ({ id: codigo, codigo, tipo, grupo: "", grupoSigla: "", atribuicao: null, descricao, expressao: null, unidades: [] });
  it("os totais são os do nível Totais; cada conta fica sob o último total, e o total sem contas se verifica ele mesmo", () => {
    const { totais, verificadas } = totaisDaDRE([
      linha("PS.PRODUCAO", "SECAO"),
      linha("P.PISTAS", "ITEM"),
      linha("RO.ROL", "TOTAL"),
      linha("ROB.ROB", "SUBTOTAL"),
      linha("ROB.RBPF", "ITEM"),
      linha("CPP.CPP", "SUBTOTAL"),
      linha("CPP.MOD.MAO", "SUBTOTAL"),
      linha("CPP.MOD.CLT", "ITEM"),
      linha("MB.MB", "TOTAL"),
    ]);
    assert.deepEqual(totais.map((t) => t.codigo), ["RO.ROL", "ROB.ROB", "CPP.CPP", "MB.MB"]);
    assert.deepEqual(
      verificadas.map((v) => `${v.total.codigo}:${v.linha.codigo}`),
      ["RO.ROL:RO.ROL", "ROB.ROB:ROB.RBPF", "CPP.CPP:CPP.MOD.CLT", "MB.MB:MB.MB"],
    );
  });
  it("os meses acima da variação máxima, para mais ou para menos; sem base quando o comparado é zero", () => {
    const valores = new Map([[1, 110], [2, 89], [3, 50], [4, 100]]);
    const comparados = new Map([[1, 100], [2, 100], [4, 100]]);
    assert.deepEqual(mesesAcima(valores, comparados, 10), [
      { mes: 2, valor: 89, comparado: 100, variacao: -11 },
      { mes: 3, valor: 50, comparado: 0, variacao: null },
    ]);
    // O comparado negativo (um custo): a variação é sobre o valor absoluto.
    assert.equal(mesesAcima(new Map([[1, -130]]), new Map([[1, -100]]), 10)[0].variacao, -30);
    // Igual à máxima em duas casas não entra (5% sobre centavos dá 5,0000005%); 5,01% entra.
    assert.deepEqual(mesesAcima(new Map([[1, 168056.29]]), new Map([[1, 160053.6088]]), 5), []);
    assert.equal(mesesAcima(new Map([[1, 105.01]]), new Map([[1, 100]]), 5)[0].variacao, 5.01);
  });
});

describe("premissas dos cenários analíticos (13/10/2026)", () => {
  it("dias úteis: segunda a sexta menos os feriados nacionais (Carnaval e Corpus Christi contam)", () => {
    assert.equal(pascoa(2026).toISOString().slice(0, 10), "2026-04-05");
    assert.deepEqual(
      Array.from({ length: 12 }, (_, k) => diasUteis(2026, k + 1)),
      [21, 20, 22, 20, 20, 22, 23, 21, 21, 21, 19, 22],
    );
    assert.equal(diasUteis(2027, 12), 23);
  });

  const item = (codigo: string, unidades: number[]) => ({ id: codigo, codigo, tipo: "ITEM" as const, grupo: "", grupoSigla: codigo.split(".")[0], atribuicao: null, descricao: codigo, expressao: null, unidades });
  const EST = [
    item("ROB.RBPF.RECEITA_BRUTA_DO_PRE_FABRICADO", [1, 2]),
    item("ROB.RBF.RECEITA_BRUTA_DE_FRETE", [1, 2]),
    item("CPP.MP.CIMENTO", [1, 2]),
    item("CPP.GGV.MADEIRAS", [1, 2]),
    item("CPP.MOD.REMUNERACOES_CLT", [1, 2]),
    item("DVV.GGV.FRETE_E_DESCARGA", [1, 2]),
  ];
  const ALVEOLARES = { codigo: "ALVEOLARES", nome: "Alveolares", unidade: 2 as const, medida: "m³ e pistas" };

  it("as linhas da tabela: a demanda em pistas e m³ por pista, as receitas, os impostos, as contas de MP, GGV e DVV (sem a mão de obra)", () => {
    const chaves = linhasDaTabela(EST, [ALVEOLARES], 2).map((l) => l.chave);
    for (const c of ["DIAS_UTEIS", "AJUSTE_RECEITA", "AJUSTE_CUSTOS", "DEMANDA:ALVEOLARES", "M3_PISTA:ALVEOLARES", "VOLUME:ALVEOLARES", "IMPOSTOS:ALVEOLARES", "CUSTO:ALVEOLARES:CPP.MP.CIMENTO", "CUSTO:ALVEOLARES:CPP.GGV.MADEIRAS", "CUSTO:ALVEOLARES:DVV.GGV.FRETE_E_DESCARGA"]) assert.ok(chaves.includes(c), c);
    assert.ok(!chaves.some((c) => c.includes("CPP.MOD")));
  });

  it("calcula: pistas × dias, × m³ por pista; a receita × (1 + ajuste) e a líquida × (1 − impostos); os custos × (1 + ajuste)", () => {
    const p: Record<string, number> = {
      "DEMANDA:ALVEOLARES": 4,
      "M3_PISTA:ALVEOLARES": 17.5,
      "RB:ALVEOLARES:ROB.RBPF.RECEITA_BRUTA_DO_PRE_FABRICADO": 1700,
      "IMPOSTOS:ALVEOLARES": 25,
      "CUSTO:ALVEOLARES:CPP.MP.CIMENTO": 300,
      AJUSTE_CUSTOS: 10,
    };
    const ler = (chave: string, mes: number) => (chave === "AJUSTE_RECEITA" && mes === 2 ? 5 : chave === "DIAS_UTEIS" && mes === 1 ? 10 : mes === 0 ? undefined : p[chave]);
    const { valores, dre } = calcularTabela(EST, [ALVEOLARES], 2, 2026, ler);
    // Janeiro: 10 dias úteis (digitados) × 4 pistas = 40 pistas × 17,5 = 700 m³.
    assert.equal(valores.get("VOLUME_PISTAS:ALVEOLARES")![0], 40);
    assert.equal(valores.get("VOLUME:ALVEOLARES")![0], 700);
    assert.equal(dre.get("P.PRODUCAO_DO_PRE_FABRICADO_PISTAS")![0], 40);
    assert.equal(dre.get("P.PRODUCAO_DO_PRE_FABRICADO_M")![0], 700);
    assert.equal(dre.get("ROB.RBPF.RECEITA_BRUTA_DO_PRE_FABRICADO")![0], 700 * 1700);
    assert.equal(dre.get("ROL.RLPF.RECEITA_LIQUIDA_DO_PRE_FABRICADO")![0], 700 * 1700 * 0.75);
    assert.equal(Math.round(dre.get("CPP.MP.CIMENTO")![0]), Math.round(700 * 300 * 1.1));
    // Fevereiro: os 20 dias do calendário e o ajuste de 5% na receita.
    assert.equal(valores.get("DIAS_UTEIS")![1], 20);
    assert.equal(Math.round(dre.get("ROB.RBPF.RECEITA_BRUTA_DO_PRE_FABRICADO")![1]), Math.round(4 * 20 * 17.5 * 1700 * 1.05));
    assert.equal(valores.get("RL:ALVEOLARES")![0], 1700 * 0.75);
  });
});
