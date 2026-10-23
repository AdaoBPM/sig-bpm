import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { baseDoPercentual, baseDoUnitario, COD } from "../src/services/relatorios/basesResultados.js";
import { lerIndicadores } from "../src/services/importacoes/indicadores/leituraIndicadores.js";
import { acumular } from "../src/services/relatorios/indicadores.js";
import { montarCatalogo } from "../src/services/relatorios/catalogoIndicadores.js";
import { ESTRUTURA_INICIAL_INDICADORES } from "../src/services/relatorios/estruturaInicialIndicadores.js";

// O catálogo da carga inicial do cadastro Estrutura dos Indicadores, com as fórmulas compiladas (sem o banco).
const INDICADORES = montarCatalogo(ESTRUTURA_INICIAL_INDICADORES);
const porNomeDoCatalogo = (n: string) => INDICADORES.find((i) => i.nome === n);
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
  it("lista os 118 indicadores, na ordem da planilha (com os GME 4 e 8 da aba Realizado e os 4 do CPV, 13/10/2026)", () => {
    assert.equal(INDICADORES.length, 118);
    const cpv = INDICADORES.findIndex((i) => i.nome === "Custo do Produto Vendido (CPV): Matriz");
    assert.equal(INDICADORES[cpv - 1].nome, "Receita Líquida: Total");
    assert.equal(INDICADORES[cpv + 4].nome, "Margem Bruta (MB): Matriz");
    assert.equal(INDICADORES[0].nome, "Custos de Produção: Matriz (CPP)");
    assert.equal(INDICADORES.at(-1)!.nome, "Atingimento da MC Acumulada");
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
    const cpp = porNome("Custos de Produção: Matriz (CPP)");
    assert.equal(cpp.calculo!(m).valor, 0.72);
    // O acumulado da razão: a soma dos numeradores sobre a dos denominadores (72 + 30) ÷ (100 + 50).
    const m2 = { ...m, dre: (u: number, c: string) => (u === 1 && c === "CPP.CUSTOS_DE_PRODUCAO_PRE_FABRICADOS_CPP" ? 30 : u === 1 && c === COD.RLPF ? 50 : 0) };
    assert.equal(acumular(cpp, [cpp.calculo!(m), cpp.calculo!(m2)]), 102 / 150);
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
      { numero: 4, celulas: ["GME", "Indicador Fora do Catálogo", "↑", 1.1, 1.1] },
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
    assert.equal(acumularMeta(porNomeDoCatalogo("Produção (Vol.): Matriz"), meses), 4000);
    assert.equal(acumularMeta(porNomeDoCatalogo("Mão de Obra: Matriz"), meses), (900 * 1000 + 1000 * 3000) / 4000);
    assert.equal(acumularMeta(porNomeDoCatalogo("Quadro de Lotação Total"), meses), 297);
  });

  it("desvio contra o orçado (com o orçado negativo, o sinal se inverte) e o sinal com a faixa de 5%", () => {
    assert.equal(vsOrcado(110, 100), 0.10000000000000009);
    assert.equal(vsOrcado(-450, -600), 0.25);
    assert.equal(sinal({ sentido: "↑" }, 104, 100), 0);
    assert.equal(sinal({ sentido: "↑" }, 90, 100), -1);
    assert.equal(sinal({ sentido: "↓" }, 90, 100), 1);
    assert.equal(sinal({ sentido: "↓" }, 120, null), null);
  });

  it("com a meta zero, sem o desvio, o sinal pelo lado do realizado (sem o cenário orçado, sem sinal)", () => {
    assert.equal(vsOrcado(1, 0), null);
    assert.equal(sinal({ sentido: "↓" }, 1, 0), -1);
    assert.equal(sinal({ sentido: "↓" }, 0, 0), 0);
    assert.equal(sinal({ sentido: "↑" }, 5, 0), 1);
    assert.equal(sinal({ sentido: "↑" }, -5, 0), -1);
    assert.equal(sinal({ sentido: "↓" }, 1, 0, false), null);
  });
});

describe("GME 4 e GME 8 (aba Realizado, linhas 112 a 115)", () => {
  const mes = (dre: Record<string, number>, importado: Record<string, number>, meta: Record<string, number>) => ({
    dre: (u: number, c: string) => (u === 0 ? (dre[c] ?? 0) : 0),
    volume: () => 0,
    importado: (n: string) => importado[n] ?? null,
    meta: (n: string) => meta[n] ?? null,
  });
  it("calcula a demanda sobre a capacidade e o atingimento acumulado pelo orçado", async () => {
    const { acumular } = await import("../src/services/relatorios/indicadores.js");
    const { encadearMeses } = await import("../src/services/relatorios/indicadoresService.js");
    const por = (n: string) => INDICADORES.find((i) => i.nome === n)!;
    const meses = encadearMeses([
      mes({ "MC.MARGEM_DE_CONTRIBUICAO_MC": 100, "S.EXPEDICAO_DO_PRE_FABRICADO_M": 50 }, { "Venda: Total": 10, "Demanda (Vol.): Total (Fabricação)": 80 }, { "Produção (Vol.): Total": 100, "Margem de Contribuição (MC): Total": 200 }),
      mes({ "MC.MARGEM_DE_CONTRIBUICAO_MC": 300, "S.EXPEDICAO_DO_PRE_FABRICADO_M": 150 }, { "Venda: Total": 30, "Demanda (Vol.): Total (Fabricação)": 120 }, { "Produção (Vol.): Total": 100, "Margem de Contribuição (MC): Total": 200 }),
    ]);
    const gerada = por("Média Móvel da Demanda Gerada");
    const partes = meses.map((m) => gerada.calculo(m));
    assert.deepEqual(partes.map((p) => p.valor), [0.8, 1.2]);
    assert.equal(acumular(gerada, partes), (0.8 * 10 + 1.2 * 30) / 40);
    const mc = por("Atingimento da MC Acumulada");
    const pmc = meses.map((m) => mc.calculo(m));
    assert.deepEqual(pmc.map((p) => p.valor), [0.5, 1]);
    assert.equal(acumular(mc, pmc), 1);
  });

  it("os GME 4 pela Metodologia (a demanda ou a expedição sobre a meta da produção, ponderadas pela venda ou pela expedição) dão o mesmo do cálculo do sistema", async () => {
    const { acumular } = await import("../src/services/relatorios/indicadores.js");
    const linha = (nome: string, formula: string, peso: string) => ({ grupo: "GME", numero: "GME 4", nome, sentido: "↑", unidade: "%", descricao: null, formula, modo: "MEDIA_PONDERADA", peso });
    const [gerada, expedida] = montarCatalogo([
      linha("Gerada", "[IND|Demanda (Vol.): Total (Fabricação)] / [META|Produção (Vol.): Total]", "[IND|Venda: Total]"),
      linha("Expedida", "[DRE|0|S.EXPEDICAO_DO_PRE_FABRICADO_M] / [META|Produção (Vol.): Total]", "[DRE|0|S.EXPEDICAO_DO_PRE_FABRICADO_M]"),
    ]);
    const meses = [
      mes({ "S.EXPEDICAO_DO_PRE_FABRICADO_M": 50 }, { "Venda: Total": 10, "Demanda (Vol.): Total (Fabricação)": 80 }, { "Produção (Vol.): Total": 100 }),
      mes({ "S.EXPEDICAO_DO_PRE_FABRICADO_M": 150 }, { "Venda: Total": 30, "Demanda (Vol.): Total (Fabricação)": 120 }, { "Produção (Vol.): Total": 100 }),
    ];
    for (const [nova, sistema] of [[gerada, "Média Móvel da Demanda Gerada"], [expedida, "Média Móvel da Demanda Expedida"]] as const) {
      const s = INDICADORES.find((i) => i.nome === sistema)!;
      const pn = meses.map((m) => nova.calculo(m));
      const ps = meses.map((m) => s.calculo(m));
      assert.deepEqual(pn.map((p) => p.valor), ps.map((p) => p.valor));
      assert.equal(acumular(nova, pn), acumular(s, ps));
    }
  });
});

describe("os indicadores de Cálculo do Sistema pela Metodologia (23/10/2026: o Acumulado no Ano e a Fórmula do Acumulado)", () => {
  const RLPF = "ROL.RLPF.RECEITA_LIQUIDA_DO_PRE_FABRICADO";
  const I = (n: string, acum = false) => `[INDICADOR|${n}${acum ? "|ACUM" : ""}]`;
  const M = (n: string, acum = false) => `[META|${n}${acum ? "|ACUM" : ""}]`;
  const eficiencia = (q: string) => ({
    formula: `(${I("Receita Líquida: Produção Matriz")} + ${I("Receita Líquida: Produção Filial")}) / ${I(`Quadro de Lotação: ${q} Total`)} / 1000`,
    modo: "FORMULA",
    peso:
      `(${I(`Eficiência da Operação: ${q} Matriz`, true)} * ${I("Receita Líquida: Produção Matriz", true)} + ${I(`Eficiência da Operação: ${q} Filial`, true)} * ${I("Receita Líquida: Produção Filial", true)})` +
      ` / (${I("Receita Líquida: Produção Matriz", true)} + ${I("Receita Líquida: Produção Filial", true)})`,
  });
  // As Metodologias que trocam o Cálculo do Sistema, pelas fórmulas da aba Realizado do INDICADORES DE RESULTADO.
  const NOVAS: Record<string, { formula: string; modo: string; peso: string | null }> = {
    "Média Móvel da Demanda Gerada": { formula: `${I("Demanda (Vol.): Total (Fabricação)")} / ${M("Produção (Vol.): Total")}`, modo: "MEDIA_PONDERADA", peso: I("Venda: Total") },
    "Média Móvel da Demanda Expedida": { formula: `${I("Expedição (Vol.): Total")} / ${M("Produção (Vol.): Total")}`, modo: "MEDIA_PONDERADA", peso: I("Expedição (Vol.): Total") },
    "Atingimento do FCOL Acumulado": { formula: `${I("Fluxo de Caixa Operacional Líquido", true)} / ${M("Fluxo de Caixa Operacional Líquido", true)}`, modo: "ULTIMO", peso: null },
    "Atingimento da MC Acumulada": { formula: `${I("Margem de Contribuição (MC): Total", true)} / ${M("Margem de Contribuição (MC): Total", true)}`, modo: "ULTIMO", peso: null },
    "Eficiência da Operação: MO Direta Total": eficiencia("MO Direta"),
    "Eficiência da Operação: MO Indireta Total": eficiencia("MO Indireta"),
    "Eficiência da Operação: MO Geral Total": eficiencia("MO Geral"),
  };
  const PELA_METODOLOGIA = montarCatalogo(ESTRUTURA_INICIAL_INDICADORES.map((r) => (NOVAS[r.nome] ? { ...r, ...NOVAS[r.nome] } : r)));
  const dos = (c: typeof INDICADORES, n: string) => c.find((i) => i.nome === n)!;
  const quase = (a: number | null, b: number | null) => (a === null || b === null ? assert.equal(a, b) : assert.ok(Math.abs(a - b) < 1e-9, `${a} × ${b}`));
  const comparar = async (nome: string, meses: Array<Parameters<(typeof INDICADORES)[number]["calculo"]>[0]>) => {
    const { acumular } = await import("../src/services/relatorios/indicadores.js");
    const { encadearMeses } = await import("../src/services/relatorios/indicadoresService.js");
    const [sistema, nova] = [dos(INDICADORES, nome), dos(PELA_METODOLOGIA, nome)];
    // Cada catálogo com os seus meses (as contas de cada mês ficam guardadas nos dados dele).
    const ms = encadearMeses(meses.map((m) => ({ ...m })));
    const mn = encadearMeses(meses.map((m) => ({ ...m })));
    const ps = ms.map((m) => sistema.calculo(m));
    const pn = mn.map((m) => nova.calculo(m));
    ps.forEach((p, k) => quase(pn[k].valor, p.valor));
    quase(acumular(nova, pn), acumular(sistema, ps));
    return pn.map((p) => p.valor);
  };
  const mes = (dre: Record<string, number>, importado: Record<string, number>, meta: Record<string, number>) => ({
    dre: (u: number, c: string) => dre[`${u}|${c}`] ?? 0,
    volume: () => 0,
    importado: (n: string) => importado[n] ?? null,
    meta: (n: string) => meta[n] ?? null,
  });
  const MC = "0|MC.MARGEM_DE_CONTRIBUICAO_MC";
  const EXP = "0|S.EXPEDICAO_DO_PRE_FABRICADO_M";
  const tres = [
    mes({ [MC]: 100, [EXP]: 50 }, { "Venda: Total": 10, "Demanda (Vol.): Total (Fabricação)": 80, "Fluxo de Caixa Operacional Líquido": 40 }, { "Produção (Vol.): Total": 100, "Margem de Contribuição (MC): Total": 200, "Fluxo de Caixa Operacional Líquido": 50 }),
    mes({ [MC]: 300, [EXP]: 150 }, { "Venda: Total": 30, "Demanda (Vol.): Total (Fabricação)": 120 }, { "Produção (Vol.): Total": 100, "Margem de Contribuição (MC): Total": 200, "Fluxo de Caixa Operacional Líquido": 50 }),
    mes({ [MC]: 50, [EXP]: 90 }, { "Venda: Total": 20, "Demanda (Vol.): Total (Fabricação)": 60, "Fluxo de Caixa Operacional Líquido": 160 }, { "Produção (Vol.): Total": 120, "Margem de Contribuição (MC): Total": 100, "Fluxo de Caixa Operacional Líquido": 50 }),
  ];

  it("os GME 4: a demanda e a expedição sobre a meta da produção, ponderadas pela venda e pela expedição", async () => {
    assert.deepEqual(await comparar("Média Móvel da Demanda Gerada", tres), [0.8, 1.2, 0.5]);
    assert.deepEqual(await comparar("Média Móvel da Demanda Expedida", tres), [0.5, 1.5, 0.75]);
  });

  it("os GME 8: o realizado de janeiro até o mês sobre o orçado do mesmo período (sem o realizado do mês, sem valor)", async () => {
    assert.deepEqual(await comparar("Atingimento da MC Acumulada", tres), [0.5, 1, 0.9]);
    // O FCOL de fevereiro não veio: o mês fica sem valor; março soma janeiro e março sobre os três orçados.
    assert.deepEqual(await comparar("Atingimento do FCOL Acumulado", tres), [0.8, null, 200 / 150]);
  });

  it("as Eficiências da Operação Totais: o mês pela receita total sobre o quadro total; o acumulado pondera os acumulados da Matriz e da Filial", async () => {
    const ef = (rm: number, rf: number, q: Record<string, number>) =>
      mes({ [`1|${RLPF}`]: rm, [`2|${RLPF}`]: rf }, Object.fromEntries(Object.entries(q).map(([k, v]) => [`Quadro de Lotação: ${k}`, v])), {});
    const meses = [
      ef(400000, 600000, { "MO Direta Matriz": 10, "MO Direta Filial": 20, "MO Direta Total": 30, "MO Indireta Matriz": 4, "MO Indireta Filial": 5, "MO Indireta Total": 9, "MO Geral Matriz": 14, "MO Geral Filial": 25, "MO Geral Total": 39 }),
      ef(900000, 300000, { "MO Direta Matriz": 12, "MO Direta Filial": 15, "MO Direta Total": 27, "MO Indireta Matriz": 5, "MO Indireta Filial": 4, "MO Indireta Total": 9, "MO Geral Matriz": 17, "MO Geral Filial": 19, "MO Geral Total": 36 }),
    ];
    for (const q of ["MO Direta", "MO Indireta", "MO Geral"]) await comparar(`Eficiência da Operação: ${q} Total`, meses);
    // MO Direta: 1.000.000 ÷ 30 ÷ 1000 e 1.200.000 ÷ 27 ÷ 1000.
    quase((await comparar("Eficiência da Operação: MO Direta Total", meses))[0], 1000 / 30);
  });
});

describe("Metodologia com outros indicadores (o item [INDICADOR], 23/10/2026)", () => {
  const linha = (nome: string, formula: string) => ({ grupo: "Geral", numero: "1", nome, sentido: "↑", unidade: "R$", descricao: null, formula, modo: "SOMA", peso: null });
  const mes = (importado: Record<string, number>, outros?: Record<string, number | null>) => ({
    dre: () => 0,
    volume: () => 0,
    importado: (n: string) => importado[n] ?? null,
    indicador: outros ? (n: string) => (n in outros ? outros[n] : undefined) : undefined,
  });
  const catalogo = montarCatalogo([
    linha("A", "[IND|Venda: Total]"),
    linha("B", "[INDICADOR|A] * 2"),
    linha("C", "[INDICADOR|B] + [INDICADOR|A]"),
    // Um ciclo (o cadastro recusa; se houver, fica sem valor).
    linha("D", "[INDICADOR|E] + 1"),
    linha("E", "[INDICADOR|D] + 1"),
    linha("F", "[INDICADOR|Inexistente] + 1"),
  ]);
  const por = (n: string) => catalogo.find((i) => i.nome === n)!;
  it("usa o valor do mês do outro indicador, encadeado, e soma no acumulado", () => {
    const meses = [mes({ "Venda: Total": 10 }), mes({ "Venda: Total": 30 })];
    assert.deepEqual(meses.map((m) => por("B").calculo(m).valor), [20, 60]);
    assert.deepEqual(meses.map((m) => por("C").calculo(m).valor), [30, 90]);
    assert.equal(acumular(por("C"), meses.map((m) => por("C").calculo(m))), 120);
    // Sem o dado do outro, sem valor.
    assert.equal(por("B").calculo(mes({})).valor, null);
  });
  it("o ciclo e o indicador que não existe ficam sem valor", () => {
    const m = mes({ "Venda: Total": 10 });
    assert.equal(por("D").calculo(m).valor, null);
    assert.equal(por("E").calculo(m).valor, null);
    assert.equal(por("F").calculo(m).valor, null);
  });
  it("os dados do mês podem dar o valor do outro (nos cenários, o importado vem das metas)", () => {
    assert.equal(por("B").calculo(mes({ "Venda: Total": 10 }, { A: 7 })).valor, 14);
    assert.equal(por("B").calculo(mes({ "Venda: Total": 10 }, { A: null })).valor, null);
  });
});
