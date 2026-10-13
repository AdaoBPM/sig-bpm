import { COD } from "./basesResultados.js";

/**
 * A carga inicial do cadastro Estrutura dos Indicadores (11/10/2026): os 118 indicadores (114 e, desde 13/10/2026, os 4
 * do Custo do Produto Vendido, no grupo Geral), na ordem e com os nomes da aba Realizado (SIG) do SIG BPM 2026 -
 * INDICADORES DE RESULTADO (o sentido, a unidade, a descrição da metodologia e
 * o acumulado vêm da aba Metas), e a fórmula de cada um — a mesma conta que a ferramenta fazia até então no código,
 * conferida mês a mês e no acumulado antes da troca.
 *
 * Modos do acumulado: SOMA (a fórmula sobre a soma de cada item nos meses com valor — nas somas, a soma dos meses;
 * nas razões, a soma dos numeradores sobre a dos denominadores, como o SUMPRODUCT da planilha); MEDIA_PONDERADA (a
 * média dos meses ponderada pela fórmula do peso); ULTIMO (o valor do último mês); SISTEMA (a conta fica no código:
 * as que a fórmula não expressa — a eficiência da operação total, que pondera os acumulados da Matriz e da Filial, e
 * os GME 4 e 8, que usam a demanda condicionada à venda e o orçado acumulado).
 */

export type ModoAcumulado = "SOMA" | "MEDIA_PONDERADA" | "ULTIMO" | "SISTEMA";
export type IndicadorInicial = {
  grupo: string;
  numero: string;
  nome: string;
  sentido: string;
  unidade: string;
  descricao: string;
  formula: string | null;
  modo: ModoAcumulado;
  peso: string | null;
};

/** As linhas da DRE usadas pelos indicadores (os códigos da estrutura). */
export const L = {
  CPP: "CPP.CUSTOS_DE_PRODUCAO_PRE_FABRICADOS_CPP",
  CSM: "CSM.CUSTOS_DE_SERVICOS_MONTAGEM_CSM",
  CPP_MOD: "CPP.MOD.MAO_DE_OBRA_DIRETA",
  CPP_MOI: "CPP.MOI.MAO_DE_OBRA_INDIRETA",
  FORMAS: "CPP.MOT.SERVICOS_DE_FORMAS_E_CONCRETAGEM",
  CPP_MP: "CPP.MP.MATERIAS_PRIMAS",
  CPP_GGV: "CPP.GGV.GASTOS_GERAIS_VARIAVEIS",
  CPP_GGD: "CPP.GGD.GASTOS_GERAIS_DIRETOS",
  CPP_GGI: "CPP.GGI.GASTOS_GERAIS_INDIRETOS",
  CSM_MOD: "CSM.MOD.MAO_DE_OBRA_DIRETA",
  CSM_MOT: "CSM.MOT.MAO_DE_OBRA_TERCEIRIZADA",
  MANUTENCAO: "CSM.GGV.MANUTENCAO_DO_MAQUINARIO",
  LOCACAO: "CSM.GGV.EQUIPAMENTOS_LOCADOS",
  PISTAS: "P.PRODUCAO_DO_PRE_FABRICADO_PISTAS",
  EXPEDICAO: "S.EXPEDICAO_DO_PRE_FABRICADO_M",
  COMISSOES: "DVV.GGV.COMISSOES_DE_REPRESENTANTES_E_TERCEIROS",
  DL: "DL.DESPESAS_DE_LOGISTICA_DL",
  DT: "DT.DESPESAS_TECNICAS_DT",
  DC: "DC.DESPESAS_COMERCIAIS_DC",
  DA: "DA.DESPESAS_ADMINISTRATIVAS_DA",
  CPV: "CPV.CUSTO_DE_PRODUTO_VENDIDO_CPV",
  MB: "MB.MARGEM_BRUTA_MB",
  MC: "MC.MARGEM_DE_CONTRIBUICAO_MC",
  EBITDA: "EBITDA.LUCRO_OPERACIONAL_EBITDA",
  RF: "NOPAT.RECEITAS_FINANCEIRAS_RF",
  DF: "NOPAT.DESPESAS_FINANCEIRAS_DF",
  RL: "RL.RESULTADO_LIQUIDO_RL",
};

// Os itens da fórmula. Matriz é a unidade 1, Filial a 2, Serviços a 3; o Consolidado (Total) é a 0.
const d = (u: number, c: string) => `[DRE|${u}|${c}]`;
const imp = (n: string) => `[IND|${n}]`;
const lista = (c: string) => `[LISTA|${c}]`;
const soma = (xs: string[]) => (xs.length > 1 ? `(${xs.join(" + ")})` : xs[0]);
const razao = (u: number, num: string[], den: string) => `${soma(num.map((c) => d(u, c)))} / ${d(u, den)}`;
const lotacao = (q: string) => imp(`Quadro de Lotação: ${q}`);

type Conta = { formula: string | null; modo?: ModoAcumulado; peso?: string };
const ponderado = (formula: string, peso: string): Conta => ({ formula, modo: "MEDIA_PONDERADA", peso });
const SISTEMA: Conta = { formula: null, modo: "SISTEMA" };

/** A conta de cada indicador, pelo nome. */
const CONTAS: Record<string, Conta> = {
  "Custos de Produção: Matriz (CPP)": { formula: razao(1, [L.CPP], COD.RLPF) },
  "Custos de Produção: Filial (CPP)": { formula: razao(2, [L.CPP], COD.RLPF) },
  "Custos de Produção: Total (CPP)": { formula: razao(0, [L.CPP], COD.RLPF) },
  "Produção (Vol.): Matriz": { formula: d(1, COD.PRODUCAO) },
  "Produção (Vol.): Filial": { formula: d(2, COD.PRODUCAO) },
  "Produção (Vol.): Total": { formula: d(0, COD.PRODUCAO) },
  "Produção (Pistas): Filial": { formula: d(2, L.PISTAS) },
  ...Object.fromEntries(
    ([["Matriz", 1], ["Filial", 2], ["Total", 0]] as const).flatMap(([n, u]) => [
      [`Mão de Obra: ${n}`, { formula: razao(u, [L.CPP_MOD, L.CPP_MOI, L.FORMAS], COD.PRODUCAO) }],
      [`Matérias Primas: ${n}`, { formula: razao(u, [L.CPP_MP], COD.PRODUCAO) }],
      [`Gastos Gerais: ${n}`, { formula: razao(u, [L.CPP_GGV, L.CPP_GGD, L.CPP_GGI], COD.PRODUCAO) }],
    ]),
  ),
  ...Object.fromEntries(
    ["MO Direta", "MO Indireta", "MO Geral"].flatMap((q) => [
      [`Quadro de Lotação: ${q} Matriz`, { formula: lotacao(`${q} Matriz`) }],
      [`Quadro de Lotação: ${q} Filial`, { formula: lotacao(`${q} Filial`) }],
      [`Quadro de Lotação: ${q} Total`, { formula: lotacao(`${q} Total`) }],
      // Volume por colaborador; o acumulado pondera pelo volume, como a planilha.
      [`Eficiência da Produção: ${q} Matriz`, ponderado(`${d(1, COD.PRODUCAO)} / ${lotacao(`${q} Matriz`)}`, d(1, COD.PRODUCAO))],
      [`Eficiência da Produção: ${q} Filial`, ponderado(`${d(2, COD.PRODUCAO)} / ${lotacao(`${q} Filial`)}`, d(2, COD.PRODUCAO))],
      [`Eficiência da Produção: ${q} Total`, ponderado(`${d(0, COD.PRODUCAO)} / ${lotacao(`${q} Total`)}`, d(0, COD.PRODUCAO))],
      [`Quadro de Lotação: ${q} Montagem`, { formula: lotacao(`${q} Montagem`) }],
      [`Eficiência da Montagem: ${q}`, ponderado(`${d(3, COD.MONTAGEM)} / ${lotacao(`${q} Montagem`)}`, d(3, COD.MONTAGEM))],
      // Receita (em milhares) por colaborador; o acumulado pondera pela receita.
      [`Eficiência da Operação: ${q} Matriz`, ponderado(`${d(1, COD.RLPF)} / ${lotacao(`${q} Matriz`)} / 1000`, d(1, COD.RLPF))],
      [`Eficiência da Operação: ${q} Filial`, ponderado(`${d(2, COD.RLPF)} / ${lotacao(`${q} Filial`)} / 1000`, d(2, COD.RLPF))],
      [`Eficiência da Operação: ${q} Total`, SISTEMA],
      [`Eficiência da Operação: ${q} Montagem`, ponderado(`${d(0, COD.RLM)} / ${lotacao(`${q} Montagem`)} / 1000`, d(0, COD.RLM))],
    ]),
  ),
  "Eficiência da Operação: Total": ponderado(`${d(0, COD.RO)} / ${imp("Quadro de Lotação Total")} / 1000`, d(0, COD.RO)),
  "Custos de Serviços: Montagem (CSM)": { formula: razao(3, [L.CSM], COD.RLM) },
  "Rendimento: Montagem": { formula: d(3, COD.MONTAGEM) },
  "Mão de Obra Direta: Montagem": { formula: razao(3, [L.CSM_MOD, L.CSM_MOT], COD.MONTAGEM) },
  "Custos e Manutenção: Guindastes": { formula: razao(3, [L.MANUTENCAO, L.LOCACAO], COD.MONTAGEM) },
  "Custos de Frete: Matriz (DVV)": { formula: d(1, COD.FRETE) },
  "Custos de Frete: Filial (DVV)": { formula: d(2, COD.FRETE) },
  "Custos de Frete: Total (DVV)": { formula: d(0, COD.FRETE) },
  "Despesas de Logística (DL)": { formula: razao(0, [L.DL], COD.RO) },
  "Expedição (Vol.): Matriz": { formula: d(1, L.EXPEDICAO) },
  "Expedição (Vol.): Filial": { formula: d(2, L.EXPEDICAO) },
  "Expedição (Vol.): Total": { formula: d(0, L.EXPEDICAO) },
  "Despesas Técnicas (DT)": { formula: razao(0, [L.DT], COD.RO) },
  "Liberação de Projetos: Matriz": { formula: lista("PROJETOS_MATRIZ") },
  "Liberação de Projetos: Filial": { formula: lista("PROJETOS_FILIAL") },
  "Liberação de Projetos: Total": { formula: lista("PROJETOS_TOTAL") },
  "Comissões de Representantes e 3os (DVV)": { formula: d(0, L.COMISSOES) },
  "Despesas Comerciais (DC)": { formula: razao(0, [L.DC], COD.RO) },
  ...Object.fromEntries(
    ["Global", "Mercantil", "Total"].flatMap((t) => [
      [`Venda: ${t}`, { formula: imp(`Venda: ${t}`) }],
      [`Receita Líquida Vendida: ${t}`, { formula: imp(`Receita Líquida Vendida: ${t}`) }],
      // A margem das vendas acumula ponderada pela venda (células Q65 a Q67 da aba Realizado).
      [`Margem de Contribuição: ${t}`, ponderado(imp(`Margem de Contribuição: ${t}`), imp(`Venda: ${t}`))],
    ]),
  ),
  "Demanda (Vol.): Matriz": { formula: imp("Demanda (Vol.): Matriz") },
  "Demanda (Vol.): Filial": { formula: imp("Demanda (Vol.): Filial") },
  "Demanda (Vol.): Total (Fabricação)": { formula: imp("Demanda (Vol.): Total (Fabricação)") },
  "Demanda (Vol.): Montagem": { formula: imp("Demanda (Vol.): Montagem") },
  "Demanda (Pistas.): Filial": { formula: imp("Demanda (Pistas.): Filial") },
  "Despesas Administrativas (DA)": { formula: razao(0, [L.DA], COD.RO) },
  "Fluxo de Caixa Operacional Líquido": { formula: imp("Fluxo de Caixa Operacional Líquido") },
  "Inadimplência": { formula: imp("Inadimplência") },
  "Quadro de Lotação Total": { formula: imp("Quadro de Lotação Total") },
  // O turnover acumula ponderado pelo quadro de lotação (célula Q77 da aba Realizado).
  "Turnover": ponderado(imp("Turnover"), imp("Quadro de Lotação Total")),
  "Abertura de Vagas x Contratações": { formula: imp("Abertura de Vagas x Contratações") },
  "Acidentes c/ Afastamento": { formula: imp("Acidentes c/ Afastamento") },
  "Receita Líquida: Produção Matriz": { formula: d(1, COD.RLPF) },
  "Receita Líquida: Produção Filial": { formula: d(2, COD.RLPF) },
  "Receita Líquida: Frete Matriz": { formula: d(1, COD.RLF) },
  "Receita Líquida: Frete Filial": { formula: d(2, COD.RLF) },
  "Receita Líquida: Devoluções e Inventários": { formula: d(0, COD.RLDI) },
  "Receita Líquida: Montagem": { formula: d(0, COD.RLM) },
  "Receita Líquida: Complementares": { formula: d(0, COD.RLC) },
  "Receita Líquida: Produção": { formula: `${d(1, COD.RO)} + ${d(2, COD.RO)}` },
  "Receita Líquida: Serviços": { formula: d(3, COD.RO) },
  "Receita Líquida: Total": { formula: d(0, COD.RO) },
  // O CPV (13/10/2026): a linha da DRE na unidade — na planilha, a receita líquida menos a margem bruta.
  "Custo do Produto Vendido (CPV): Matriz": { formula: d(1, L.CPV) },
  "Custo do Produto Vendido (CPV): Filial": { formula: d(2, L.CPV) },
  "Custo do Produto Vendido (CPV): Serviços": { formula: d(3, L.CPV) },
  "Custo do Produto Vendido (CPV): Total": { formula: d(0, L.CPV) },
  "Margem Bruta (MB): Matriz": { formula: d(1, L.MB) },
  "Margem Bruta (MB): Filial": { formula: d(2, L.MB) },
  "Margem Bruta (MB): Serviços": { formula: d(3, L.MB) },
  "Margem Bruta (MB): Total": { formula: d(0, L.MB) },
  "Margem de Contribuição (MC): Total": { formula: d(0, L.MC) },
  "Lucro Operacional (EBITDA)": { formula: d(0, L.EBITDA) },
  "Resultado Financeiro (RF)": { formula: `${d(0, L.RF)} - ${d(0, L.DF)}` },
  "Resultado Líquido (RL)": { formula: d(0, L.RL) },
  // O mix acumula ponderado pela venda total (célula Q111 da aba Realizado).
  "Repres. do Mix Ampliado nas Vendas": ponderado(imp("Repres. do Mix Ampliado nas Vendas"), imp("Venda: Total")),
  "Média Móvel da Demanda Gerada": SISTEMA,
  "Média Móvel da Demanda Expedida": SISTEMA,
  "Atingimento do FCOL Acumulado": SISTEMA,
  "Atingimento da MC Acumulada": SISTEMA,
};

type Tupla = [grupo: string, numero: string, nome: string, sentido: string, unidade: string, descricao: string, acumulado: "ACUM" | "ATUAL"];

const LISTA: Tupla[] = [
  ["Produção", "", "Custos de Produção: Matriz (CPP)", "↓", "%", "Percentual sobre ROL (Pré-Fabricado)", "ACUM"],
  ["Produção", "", "Custos de Produção: Filial (CPP)", "↓", "%", "Percentual sobre ROL (Pré-Fabricado)", "ACUM"],
  ["Produção", "", "Custos de Produção: Total (CPP)", "↓", "%", "Percentual sobre ROL (Pré-Fabricado)", "ACUM"],
  ["Produção", "1", "Produção (Vol.): Matriz", "↑", "m³", "Total da Produção", "ACUM"],
  ["Produção", "1", "Produção (Vol.): Filial", "↑", "m³", "Total da Produção", "ACUM"],
  ["Produção", "1", "Produção (Vol.): Total", "↑", "m³", "Total da Produção", "ACUM"],
  ["Produção", "2", "Produção (Pistas): Filial", "↑", "pistas", "Total da Produção", "ACUM"],
  ["Produção", "3", "Mão de Obra: Matriz", "↓", "R$/m³", "(MOD +MOI +Formas 3os) / Produção: Estrutura", "ACUM"],
  ["Produção", "3", "Mão de Obra: Filial", "↓", "R$/m³", "(MOD +MOI +Formas 3os) / Produção: Alveolares", "ACUM"],
  ["Produção", "3", "Mão de Obra: Total", "↓", "R$/m³", "(MOD +MOI +Formas 3os) / Produção: Total", "ACUM"],
  ["Produção", "4", "Matérias Primas: Matriz", "↓", "R$/m³", "Matérias Primas / Produção: Estrutura", "ACUM"],
  ["Produção", "4", "Matérias Primas: Filial", "↓", "R$/m³", "Matérias Primas / Produção: Alveolares", "ACUM"],
  ["Produção", "4", "Matérias Primas: Total", "↓", "R$/m³", "Matérias Primas / Produção: Total", "ACUM"],
  ["Produção", "5", "Gastos Gerais: Matriz", "↓", "R$/m³", "(GGV +GGD +GGI) / Produção: Estrutura", "ACUM"],
  ["Produção", "5", "Gastos Gerais: Filial", "↓", "R$/m³", "(GGV +GGD +GGI) / Produção: Alveolares", "ACUM"],
  ["Produção", "5", "Gastos Gerais: Total", "↓", "R$/m³", "(GGV +GGD +GGI) / Produção: Total", "ACUM"],
  ["Produção", "6", "Quadro de Lotação: MO Direta Matriz", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Direta Filial", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Direta Total", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Indireta Matriz", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Indireta Filial", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Indireta Total", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Geral Matriz", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Geral Filial", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "6", "Quadro de Lotação: MO Geral Total", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Produção", "7", "Eficiência da Produção: MO Direta Matriz", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Direta Filial", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Direta Total", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Indireta Matriz", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Indireta Filial", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Indireta Total", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Geral Matriz", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Geral Filial", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Produção", "7", "Eficiência da Produção: MO Geral Total", "↑", "m³/colab.", "Produção / Colaboradores", "ACUM"],
  ["Serviços", "", "Custos de Serviços: Montagem (CSM)", "↓", "%", "Percentual sobre ROL (Montagem)", "ACUM"],
  ["Serviços", "1", "Rendimento: Montagem", "↑", "m³", "Total Expedido para Obras", "ACUM"],
  ["Serviços", "2", "Mão de Obra Direta: Montagem", "↓", "R$/m³", "(MOD +ST de Montagem) / Rendimento", "ACUM"],
  ["Serviços", "3", "Custos e Manutenção: Guindastes", "↓", "R$/m³", "(Manutenção +Locação) / Rendimento", "ACUM"],
  ["Serviços", "4", "Quadro de Lotação: MO Direta Montagem", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Serviços", "4", "Quadro de Lotação: MO Indireta Montagem", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Serviços", "4", "Quadro de Lotação: MO Geral Montagem", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Serviços", "5", "Eficiência da Montagem: MO Direta", "↑", "m³/colab.", "Rendimento / Colaboradores", "ACUM"],
  ["Serviços", "5", "Eficiência da Montagem: MO Indireta", "↑", "m³/colab.", "Rendimento / Colaboradores", "ACUM"],
  ["Serviços", "5", "Eficiência da Montagem: MO Geral", "↑", "m³/colab.", "Rendimento / Colaboradores", "ACUM"],
  ["Logística", "", "Custos de Frete: Matriz (DVV)", "↓", "R$", "Total conforme DRE", "ACUM"],
  ["Logística", "", "Custos de Frete: Filial (DVV)", "↓", "R$", "Total conforme DRE", "ACUM"],
  ["Logística", "", "Custos de Frete: Total (DVV)", "↓", "R$", "Total conforme DRE", "ACUM"],
  ["Logística", "", "Despesas de Logística (DL)", "↓", "%", "Total conforme DRE", "ACUM"],
  ["Logística", "1", "Expedição (Vol.): Matriz", "↑", "m³", "Total da Expedição", "ACUM"],
  ["Logística", "1", "Expedição (Vol.): Filial", "↑", "m³", "Total da Expedição", "ACUM"],
  ["Logística", "1", "Expedição (Vol.): Total", "↑", "m³", "Total da Expedição", "ACUM"],
  ["Técnico", "", "Despesas Técnicas (DT)", "↓", "%", "Total conforme DRE", "ACUM"],
  ["Técnico", "1", "Liberação de Projetos: Matriz", "↑", "m³", "Total de Projetos (Estrutura)", "ACUM"],
  ["Técnico", "1", "Liberação de Projetos: Filial", "↑", "m³", "Total de Projetos (Alveolares Globais)", "ACUM"],
  ["Técnico", "1", "Liberação de Projetos: Total", "↑", "m³", "Total de Projetos (Estrutura e Alveolares Globais)", "ACUM"],
  ["Comercial", "", "Comissões de Representantes e 3os (DVV)", "↑", "R$", "Percentual sobre ROL (Total)", "ACUM"],
  ["Comercial", "", "Despesas Comerciais (DC)", "↑", "%", "Percentual sobre ROL (Total)", "ACUM"],
  ["Comercial", "1", "Venda: Global", "↑", "R$", "Total das Vendas", "ACUM"],
  ["Comercial", "1", "Venda: Mercantil", "↑", "R$", "Total das Vendas", "ACUM"],
  ["Comercial", "1", "Venda: Total", "↑", "R$", "Total das Vendas", "ACUM"],
  ["Comercial", "2", "Receita Líquida Vendida: Global", "↑", "R$", "Total das Vendas", "ACUM"],
  ["Comercial", "2", "Receita Líquida Vendida: Mercantil", "↑", "R$", "Total das Vendas", "ACUM"],
  ["Comercial", "2", "Receita Líquida Vendida: Total", "↑", "R$", "Total das Vendas", "ACUM"],
  ["Comercial", "3", "Margem de Contribuição: Global", "↑", "%", "Média das Vendas", "ACUM"],
  ["Comercial", "3", "Margem de Contribuição: Mercantil", "↑", "%", "Média das Vendas", "ACUM"],
  ["Comercial", "3", "Margem de Contribuição: Total", "↑", "%", "Média das Vendas", "ACUM"],
  ["Comercial", "4", "Demanda (Vol.): Matriz", "↑", "m³", "Total da Demanda", "ACUM"],
  ["Comercial", "4", "Demanda (Vol.): Filial", "↑", "m³", "Total da Demanda", "ACUM"],
  ["Comercial", "4", "Demanda (Vol.): Total (Fabricação)", "↑", "m³", "Total da Demanda", "ACUM"],
  ["Comercial", "4", "Demanda (Vol.): Montagem", "↑", "m³", "Total da Demanda (Estrutura e Alveolares Globais)", "ACUM"],
  ["Comercial", "5", "Demanda (Pistas.): Filial", "↑", "pistas", "Total da Demanda", "ACUM"],
  ["Administrativo", "", "Despesas Administrativas (DA)", "↑", "%", "Total conforme DRE", "ACUM"],
  ["Administrativo", "1", "Fluxo de Caixa Operacional Líquido", "↑", "R$", "Saldo Operacional do Fluxo de Caixa", "ACUM"],
  ["Administrativo", "2", "Inadimplência", "↓", "%", "Valor Vencido / Carteira em aberto", "ATUAL"],
  ["Administrativo", "3", "Quadro de Lotação Total", "=", "colab.", "Total de Colaboradores", "ATUAL"],
  ["Administrativo", "4", "Turnover", "↓", "%", "Rescisões / Colaboradores", "ACUM"],
  ["Administrativo", "5", "Abertura de Vagas x Contratações", "-", "ocorr.", "Quantia de funções para reposição/contratação", "ATUAL"],
  ["Administrativo", "6", "Acidentes c/ Afastamento", "↓", "ocorr.", "Registro de Lesões com Afastamento (Abertura de CAT)", "ACUM"],
  ["Geral", "", "Receita Líquida: Produção Matriz", "↑", "R$", "Receita Operacional Líquida de Produção e Frete", "ACUM"],
  ["Geral", "", "Receita Líquida: Produção Filial", "↑", "R$", "Receita Operacional Líquida de Produção e Frete", "ACUM"],
  ["Geral", "", "Receita Líquida: Frete Matriz", "↑", "R$", "Receita Operacional Líquida de Produção e Frete", "ACUM"],
  ["Geral", "", "Receita Líquida: Frete Filial", "↑", "R$", "Receita Operacional Líquida de Produção e Frete", "ACUM"],
  ["Geral", "", "Receita Líquida: Devoluções e Inventários", "↑", "R$", "Receita Operacional Líquida de Produção e Frete", "ACUM"],
  ["Geral", "", "Receita Líquida: Montagem", "↑", "R$", "Receita Operacional Líquida de Montagem", "ACUM"],
  ["Geral", "", "Receita Líquida: Complementares", "↑", "R$", "Receita Operacional Líquida Complementar", "ACUM"],
  ["Geral", "", "Receita Líquida: Produção", "↑", "R$", "Receita Operacional Líquida de Produção e Frete", "ACUM"],
  ["Geral", "", "Receita Líquida: Serviços", "↑", "R$", "Receita Operacional Líquida de Montagem e Complementar", "ACUM"],
  ["Geral", "", "Receita Líquida: Total", "↑", "R$", "Receita Operacional Líquida Total", "ACUM"],
  // O Custo do Produto Vendido (13/10/2026) entrou como o 1 do grupo; os seguintes subiram um número, como na planilha.
  // O nome é o da aba Metas ("Custo do Produto Vendido"; a Realizado (SIG) traz "Custo de Produto Vendido"); o sentido,
  // o da aba Metas (↑; o Painel (Resultados) usa ↓, e o card do painel também).
  ["Geral", "1", "Custo do Produto Vendido (CPV): Matriz", "↑", "R$", "Custo do Produto Vendido", "ACUM"],
  ["Geral", "1", "Custo do Produto Vendido (CPV): Filial", "↑", "R$", "Custo do Produto Vendido", "ACUM"],
  ["Geral", "1", "Custo do Produto Vendido (CPV): Serviços", "↑", "R$", "Custo do Produto Vendido", "ACUM"],
  ["Geral", "1", "Custo do Produto Vendido (CPV): Total", "↑", "R$", "Custo do Produto Vendido", "ACUM"],
  ["Geral", "2", "Margem Bruta (MB): Matriz", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "2", "Margem Bruta (MB): Filial", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "2", "Margem Bruta (MB): Serviços", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "2", "Margem Bruta (MB): Total", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "3", "Margem de Contribuição (MC): Total", "↑", "R$", "Margem de Contribuição", "ACUM"],
  ["Geral", "4", "Lucro Operacional (EBITDA)", "↑", "R$", "EBITDA", "ACUM"],
  ["Geral", "5", "Resultado Financeiro (RF)", "↑", "R$", "Receitas Financeiras - Despesas Financeiras", "ACUM"],
  ["Geral", "6", "Resultado Líquido (RL)", "↑", "R$", "Resultado Líquido", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Direta Matriz", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Direta Filial", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Direta Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Indireta Matriz", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Indireta Filial", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Indireta Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Geral Matriz", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Geral Filial", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Geral Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "8", "Eficiência da Operação: MO Direta Montagem", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "8", "Eficiência da Operação: MO Indireta Montagem", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "8", "Eficiência da Operação: MO Geral Montagem", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "9", "Eficiência da Operação: Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["GME", "GME 3", "Repres. do Mix Ampliado nas Vendas", "↑", "%", "Venda Complementar / Venda Total", "ACUM"],
  ["GME", "GME 4", "Média Móvel da Demanda Gerada", "↑", "%", "Demanda Gerada / Capacidade de Produção (Global)", "ACUM"],
  ["GME", "GME 4", "Média Móvel da Demanda Expedida", "↑", "%", "Demanda Expedida / Capacidade de Produção (Global)", "ACUM"],
  ["GME", "GME 8", "Atingimento do FCOL Acumulado", "↑", "%", "Realizado / Orçado", "ATUAL"],
  ["GME", "GME 8", "Atingimento da MC Acumulada", "↑", "%", "Realizado / Orçado", "ATUAL"],
];

export const ESTRUTURA_INICIAL_INDICADORES: IndicadorInicial[] = LISTA.map(([grupo, numero, nome, sentido, unidade, descricao, acumulado]) => {
  const c = CONTAS[nome];
  if (!c) throw new Error(`Indicador sem conta na carga inicial: ${nome}`);
  // Os de posição (ATUAL na aba Metas) valem o último mês; os do sistema guardam o acumulado da planilha no código.
  const modo: ModoAcumulado = c.modo === "SISTEMA" ? "SISTEMA" : acumulado === "ATUAL" ? "ULTIMO" : (c.modo ?? "SOMA");
  return { grupo, numero, nome, sentido, unidade, descricao, formula: c.formula, modo, peso: c.peso ?? null };
});
