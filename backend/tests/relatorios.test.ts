import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baseDoPercentual, baseDoUnitario, COD } from "../src/services/relatorios/basesResultados.js";
import { lerIndicadores } from "../src/services/importacoes/indicadores/leituraIndicadores.js";
import { acumular, INDICADORES } from "../src/services/relatorios/indicadores.js";
import { acumularMeta } from "../src/services/relatorios/metasOrcamento.js";
import { sinal, vsOrcado } from "../src/services/relatorios/painelDeBordo.js";

const linha = (codigo: string) => ({ codigo, grupoSigla: codigo.split(".")[0] });

describe("relatório de Resultados: bases do % e do R$/m³ (abas Resultados (…), 08/10/2026)", () => {
  it("receitas sobre a ROB; custos sobre a receita líquida da natureza; o resto sobre a ROL", () => {
    assert.equal(baseDoPercentual(0, linha(COD.RBPF)), COD.ROB);
    assert.equal(baseDoPercentual(0, linha(COD.RLM)), COD.ROB);
    assert.equal(baseDoPercentual(0, linha("IRB.IO.IMPOSTOS_OPERACIONAIS")), COD.ROB);
    assert.equal(baseDoPercentual(0, linha("CPP.MOD.REMUNERACOES_CLT")), COD.RLPF);
    assert.equal(baseDoPercentual(2, linha("CPP.MOD.REMUNERACOES_CLT")), COD.RLPF); // Filial também (planilha corrigida em 08/10/2026)
    assert.equal(baseDoPercentual(3, linha("CSM.CUSTOS_DE_SERVICOS_MONTAGEM_CSM")), COD.RLM);
    assert.equal(baseDoPercentual(3, linha("CSC.MOD.HORAS_EXTRAS")), COD.RLC);
    assert.equal(baseDoPercentual(0, linha(COD.FRETE)), COD.RLF);
    assert.equal(baseDoPercentual(4, linha("DA.DESPESAS_ADMINISTRATIVAS_DA")), COD.RO);
    assert.equal(baseDoPercentual(0, linha(COD.PRODUCAO)), null);
  });

  it("R$/m³ só no pré-fabricado (produção) e na montagem", () => {
    assert.equal(baseDoUnitario(linha(COD.RLPF)), COD.PRODUCAO);
    assert.equal(baseDoUnitario(linha("CPP.MP.CIMENTO")), COD.PRODUCAO);
    assert.equal(baseDoUnitario(linha(COD.RBM)), COD.MONTAGEM);
    assert.equal(baseDoUnitario(linha("CSM.MOD.MAO_DE_OBRA_DIRETA")), COD.MONTAGEM);
    assert.equal(baseDoUnitario(linha("CSC.MOD.MAO_DE_OBRA_DIRETA")), null);
    assert.equal(baseDoUnitario(linha(COD.RLF)), null);
  });
});

describe("indicadores (aba Realizado (SIG) e Metas, 08/10/2026)", () => {
  it("lista os 110 indicadores, na ordem da planilha", () => {
    assert.equal(INDICADORES.length, 110);
    assert.equal(INDICADORES[0].nome, "Custos de Produção: Matriz (CPP)");
    assert.equal(INDICADORES.at(-1)!.nome, "Repres. do Mix Ampliado nas Vendas");
  });

  it("acumula como a aba Realizado: soma, média ponderada pelo peso ou o último mês", () => {
    // Razão: o peso é o denominador — a soma dos numeradores sobre a dos denominadores.
    const razoes = [
      { valor: 0.7, peso: 100 },
      { valor: 0.3, peso: 300 },
    ];
    assert.equal(acumular({ acumulado: "ACUM" }, razoes), (0.7 * 100 + 0.3 * 300) / 400);
    assert.equal(acumular({ acumulado: "ACUM" }, [{ valor: 10 }, null, { valor: 5 }]), 15);
    assert.equal(acumular({ acumulado: "ATUAL" }, [{ valor: 10 }, { valor: 5 }, { valor: null }]), 5);
    assert.equal(acumular({ acumulado: "ACUM" }, [null, { valor: null }]), null);
    // Componentes (Matriz e Filial): pondera cada um pelo próprio peso.
    const comp = acumular({ acumulado: "ACUM" }, [{ valor: 0.5, componentes: [{ valor: 0.4, peso: 1 }, { valor: 0.8, peso: 3 }] }])!;
    assert.ok(Math.abs(comp - 0.7) < 1e-12);
  });

  it("calcula da DRE e dos importados: Custos de Produção da Matriz, eficiência da produção, turnover", () => {
    const porNome = (n: string) => INDICADORES.find((i) => i.nome === n)!;
    const dre = (u: number, c: string) =>
      u === 1 && c === "CPP.CUSTOS_DE_PRODUCAO_PRE_FABRICADOS_CPP" ? 72 : u === 1 && c === COD.RLPF ? 100 : u === 1 && c === COD.PRODUCAO ? 1065.72 : 0;
    const importados: Record<string, number> = { "Quadro de Lotação: MO Direta Matriz": 90, Turnover: 0.05, "Quadro de Lotação Total": 274 };
    const m = { dre, volume: () => 0, importado: (n: string) => importados[n] ?? null };
    assert.deepEqual(porNome("Custos de Produção: Matriz (CPP)").calculo!(m), { valor: 0.72, peso: 100 });
    const ef = porNome("Eficiência da Produção: MO Direta Matriz").calculo!(m);
    assert.equal(ef.valor!.toFixed(2), "11.84"); // 1.065,72 m³ ÷ 90 colaboradores, como na planilha
    assert.equal(ef.peso, 1065.72);
    assert.deepEqual(porNome("Turnover").calculo!(m), { valor: 0.05, peso: 274 });
    // No mês sem apuração (DRE em NaN), o indicador da DRE fica sem valor.
    assert.equal(porNome("Custos de Produção: Matriz (CPP)").calculo!({ ...m, dre: () => NaN }).valor, null);
    // Sem o indicador importado, sem valor.
    assert.equal(porNome("Venda: Global").calculo!(m).valor, null);
  });
});

describe("indicadores importados (abas Indicadores (Admin.) e (Comercial))", () => {
  const linhas = [
    { numero: 1, celulas: ["INDICADOR", "TIPO", "UNIDADE", "METODOLOGIA", 46023, 46054] },
    { numero: 2, celulas: ["Quadro de Lotação: MO Direta Matriz", "=", "colab.", "Total", 90, 90] },
    { numero: 3, celulas: ["Turnover", "↓", "%", "Rescisões", 0.05, null] },
    { numero: 4, celulas: ["Indicador Novo", "↑", "R$", "?", 1, 2] },
  ];
  it("lê a coluna do mês (data do dia 1º) e rejeita o indicador fora do catálogo", () => {
    const l = lerIndicadores("INDICADORES_ADMIN", linhas, 2026, 1);
    assert.ok(l.ok);
    assert.deepEqual(l.valores.map((v) => [v.nome, v.valor]), [["Quadro de Lotação: MO Direta Matriz", 90], ["Turnover", 0.05]]);
    assert.equal(l.rejeicoes[0].codigo, "INDICADOR_DESCONHECIDO");
    const fev = lerIndicadores("INDICADORES_ADMIN", linhas, 2026, 2);
    assert.ok(fev.ok);
    assert.equal(fev.vazias, 1); // o turnover vazio em fevereiro
    assert.equal(lerIndicadores("INDICADORES_ADMIN", linhas, 2026, 3).ok, false); // sem a coluna de março
  });
});

describe("metas do orçamento (aba Metas (Orçamento)) e Painel de Bordo", () => {
  it("lê a coluna INDICADOR depois de GRUPO, aceita o apelido e ignora as linhas fora do catálogo", () => {
    const linhas = [
      { numero: 1, celulas: ["GRUPO", "INDICADOR", "TIPO", "JAN/2026", "FEV/2026"] },
      { numero: 2, celulas: ["Produção", "Produção (Vol.): Matriz", "↑", 1065.718, 1110.197] },
      { numero: 3, celulas: ["4", "Quadro de Lotação", "=", 297, 297] },
      { numero: 4, celulas: ["GME", "Média Móvel da Demanda Gerada", "↑", 1.1, 1.1] },
    ];
    const l = lerIndicadores("METAS_ORCAMENTO", linhas, 2026, 2);
    assert.ok(l.ok);
    assert.deepEqual(l.valores.map((v) => [v.nome, v.valor]), [["Produção (Vol.): Matriz", 1110.197], ["Quadro de Lotação Total", 297]]);
    assert.equal(l.rejeicoes.length, 0);
  });

  it("acumula a meta como a coluna Y da aba Metas: soma, média ponderada pela base e último mês", () => {
    const mes = (o: Record<string, number>) => new Map(Object.entries(o));
    const meses = [
      mes({ "Produção (Vol.): Matriz": 1000, "Mão de Obra: Matriz": 900, "Quadro de Lotação Total": 290 }),
      mes({ "Produção (Vol.): Matriz": 3000, "Mão de Obra: Matriz": 1000, "Quadro de Lotação Total": 297 }),
    ];
    assert.equal(acumularMeta("Produção (Vol.): Matriz", meses), 4000);
    assert.equal(acumularMeta("Mão de Obra: Matriz", meses), (900 * 1000 + 1000 * 3000) / 4000);
    assert.equal(acumularMeta("Quadro de Lotação Total", meses), 297);
  });

  it("desvio contra o orçado (com o orçado negativo, o sinal se inverte) e o sinal com a faixa de 5%", () => {
    assert.equal(vsOrcado(110, 100), 0.10000000000000009);
    assert.equal(vsOrcado(-450, -600), 0.25);
    assert.equal(sinal({ sentido: "↑" }, 104, 100), 0);
    assert.equal(sinal({ sentido: "↑" }, 90, 100), -1);
    assert.equal(sinal({ sentido: "↓" }, 90, 100), 1);
    assert.equal(sinal({ sentido: "↓" }, 120, null), null);
  });
});
