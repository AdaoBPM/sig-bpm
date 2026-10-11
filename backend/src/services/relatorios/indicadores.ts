import { COD } from "./basesResultados.js";

/**
 * Os indicadores de resultado, na ordem e com os nomes da aba Realizado (SIG)
 * do SIG BPM 2026 - INDICADORES DE RESULTADO; o sentido, a unidade, a
 * metodologia e o acumulado vêm da aba Metas.
 *
 * O cálculo de cada mês sai da DRE apurada (por unidade), dos volumes
 * congelados da apuração e dos indicadores importados das abas Indicadores
 * (Admin.) e Indicadores (Comercial): o quadro de lotação, o fluxo de caixa,
 * as vendas, a demanda… Conferido contra a aba Realizado (SIG) em 08/10/2026:
 * igual em todos os meses cujos dados não mudaram desde a cópia para a
 * planilha.
 *
 * Acumulado, como a aba Realizado: ACUM soma os meses ou, quando o indicador
 * tem peso, é a média dos meses ponderada por ele (SUMPRODUCT) — nas razões
 * (%, R$/m³), o peso é o denominador, e a média é a soma dos numeradores sobre
 * a dos denominadores; nas eficiências, o volume ou a receita; na margem das
 * vendas, a venda. ATUAL é o valor do último mês.
 */

/**
 * Os valores de um mês: a DRE apurada de uma visão (0 Consolidado, 1..5 as
 * unidades), os volumes congelados e os indicadores importados. No mês sem
 * apuração, a DRE e os volumes valem NaN, e o indicador que depende deles fica
 * sem valor; sem o indicador importado, null.
 */
export type DadosDoMes = {
  dre: (unidade: number, codigo: string) => number;
  volume: (origem: string) => number;
  importado: (nome: string) => number | null;
  /** As metas importadas do mês (aba Metas (Orçamento)): a capacidade de produção e o orçado dos atingimentos (GME 4 e GME 8). */
  meta?: (nome: string) => number | null;
  /** Os meses anteriores do exercício, em ordem (os atingimentos acumulados do GME 8). */
  anteriores?: DadosDoMes[];
};
/** O valor do mês e o peso dele no acumulado; `componentes`, quando o acumulado pondera partes (Matriz e Filial) em vez do total. */
export type Parte = { valor: number | null; peso?: number; componentes?: Array<{ valor: number | null; peso: number }> };
type Calculo = (m: DadosDoMes) => Parte;

export type Indicador = {
  grupo: string;
  /** O número do indicador no grupo, como na planilha; vazio nos indicadores principais do grupo. */
  numero: string;
  nome: string;
  /** ↑ quanto maior melhor, ↓ quanto menor melhor, = acompanhamento, - sem sentido. */
  sentido: string;
  unidade: string;
  metodologia: string;
  acumulado: "ACUM" | "ATUAL";
  calculo: Calculo;
};

const L = {
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
  MB: "MB.MARGEM_BRUTA_MB",
  MC: "MC.MARGEM_DE_CONTRIBUICAO_MC",
  EBITDA: "EBITDA.LUCRO_OPERACIONAL_EBITDA",
  RF: "NOPAT.RECEITAS_FINANCEIRAS_RF",
  DF: "NOPAT.DESPESAS_FINANCEIRAS_DF",
  RL: "RL.RESULTADO_LIQUIDO_RL",
};

/** a ÷ b; sem divisor (zero ou sem dado), sem valor. */
const divide = (a: number, b: number) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null);
const finito = (x: number) => (Number.isFinite(x) ? x : null);

// Matriz é a unidade 1, Filial a 2, Serviços a 3; o Consolidado (Total) é a 0.
const v = (u: number, c: string): Calculo => (m) => ({ valor: finito(m.dre(u, c)) });
/** Razão da DRE: o peso no acumulado é o denominador (a soma dos numeradores sobre a dos denominadores). */
const razao = (u: number, num: string[], den: string): Calculo => (m) => {
  const d = m.dre(u, den);
  return { valor: divide(num.reduce((s, c) => s + m.dre(u, c), 0), d), peso: d };
};
const maoDeObra = (u: number) => razao(u, [L.CPP_MOD, L.CPP_MOI, L.FORMAS], COD.PRODUCAO);
const gastosGerais = (u: number) => razao(u, [L.CPP_GGV, L.CPP_GGD, L.CPP_GGI], COD.PRODUCAO);
const projetos = (...origens: string[]): Calculo => (m) => ({ valor: finito(origens.reduce((s, o) => s + m.volume(o), 0)) });

/** Indicador importado (abas Indicadores (Admin.) e (Comercial)), com o peso do acumulado, quando houver. */
const importado = (nome: string, peso?: (m: DadosDoMes) => number | null): Calculo => (m) => ({ valor: m.importado(nome), peso: peso ? (peso(m) ?? undefined) : undefined });
const lotacao = (m: DadosDoMes, quadro: string) => m.importado(`Quadro de Lotação: ${quadro}`) ?? NaN;

/** Volume (ou receita) por colaborador do quadro; o acumulado pondera pelo volume (ou pela receita), como a planilha. */
const porColaborador =
  (numerador: (m: DadosDoMes) => number, quadro: (m: DadosDoMes) => number, escala = 1): Calculo =>
  (m) => {
    const n = numerador(m);
    const q = divide(n, quadro(m));
    return { valor: q === null ? null : q / escala, peso: n };
  };
const producao = (u: number) => (m: DadosDoMes) => m.dre(u, COD.PRODUCAO);
const rendimento = (m: DadosDoMes) => m.dre(3, COD.MONTAGEM);
const receitaProducao = (u: number) => (m: DadosDoMes) => m.dre(u, COD.RLPF);
/** Eficiência da operação da Matriz e da Filial juntas: o acumulado pondera os acumulados de cada uma pela receita (célula Q100 da aba Realizado). */
const operacaoTotal =
  (quadro: string): Calculo =>
  (m) => {
    const matriz = porColaborador(receitaProducao(1), (x) => lotacao(x, `${quadro} Matriz`), 1000)(m);
    const filial = porColaborador(receitaProducao(2), (x) => lotacao(x, `${quadro} Filial`), 1000)(m);
    const total = porColaborador((x) => x.dre(1, COD.RLPF) + x.dre(2, COD.RLPF), (x) => lotacao(x, `${quadro} Total`), 1000)(m);
    return { valor: total.valor, componentes: [matriz, filial].map((p) => ({ valor: p.valor, peso: p.peso ?? 0 })) };
  };
const venda = (tipo: string) => (m: DadosDoMes) => m.importado(`Venda: ${tipo}`);

/** O valor do mês de outro indicador do catálogo. */
const valorDe = (nome: string, m: DadosDoMes) => CALCULOS[nome](m).valor;

/**
 * GME 4 (aba Realizado do INDICADORES DE RESULTADO, linhas 112 e 113): o volume do mês sobre a capacidade de produção,
 * que é a meta de Produção (Vol.): Total do mês (Metas!M7). A demanda gerada só tem valor no mês com a Venda: Total, e
 * o acumulado pondera pela venda; a expedida pondera pela expedição.
 */
const sobreCapacidade = (volume: (m: DadosDoMes) => number | null, peso: (m: DadosDoMes) => number | null): Calculo => (m) => {
  const p = peso(m);
  if (p === null || !Number.isFinite(p)) return { valor: null };
  return { valor: divide(volume(m) ?? NaN, m.meta?.("Produção (Vol.): Total") ?? NaN), peso: p };
};

/**
 * GME 8 (linhas 114 e 115): o realizado de janeiro até o mês sobre o orçado do mesmo período (as metas importadas);
 * o acumulado é o do último mês.
 */
const atingimentoAcumulado = (nome: string): Calculo => (m) => {
  if (valorDe(nome, m) === null) return { valor: null };
  const meses = [...(m.anteriores ?? []), m];
  const realizado = meses.reduce((s, x) => s + (valorDe(nome, x) ?? 0), 0);
  const orcado = meses.reduce((s, x) => s + (x.meta?.(nome) ?? 0), 0);
  return { valor: divide(realizado, orcado) };
};

const CALCULOS: Record<string, Calculo> = {
  "Custos de Produção: Matriz (CPP)": razao(1, [L.CPP], COD.RLPF),
  // Sobre a Receita Líquida do Pré-Fabricado, como na Matriz (aba Resultados (Filial) corrigida em 08/10/2026).
  "Custos de Produção: Filial (CPP)": razao(2, [L.CPP], COD.RLPF),
  // O mês é o do Consolidado; o acumulado pondera os acumulados da Matriz e da Filial pela receita do pré-fabricado (célula Q4 da aba Realizado).
  "Custos de Produção: Total (CPP)": (m) => ({
    valor: divide(m.dre(0, L.CPP), m.dre(0, COD.RLPF)),
    componentes: [razao(1, [L.CPP], COD.RLPF)(m), razao(2, [L.CPP], COD.RLPF)(m)].map((p) => ({ valor: p.valor, peso: p.peso ?? 0 })),
  }),
  "Produção (Vol.): Matriz": v(1, COD.PRODUCAO),
  "Produção (Vol.): Filial": v(2, COD.PRODUCAO),
  "Produção (Vol.): Total": v(0, COD.PRODUCAO),
  "Produção (Pistas): Filial": v(2, L.PISTAS),
  "Mão de Obra: Matriz": maoDeObra(1),
  "Mão de Obra: Filial": maoDeObra(2),
  "Mão de Obra: Total": maoDeObra(0),
  "Matérias Primas: Matriz": razao(1, [L.CPP_MP], COD.PRODUCAO),
  "Matérias Primas: Filial": razao(2, [L.CPP_MP], COD.PRODUCAO),
  "Matérias Primas: Total": razao(0, [L.CPP_MP], COD.PRODUCAO),
  "Gastos Gerais: Matriz": gastosGerais(1),
  "Gastos Gerais: Filial": gastosGerais(2),
  "Gastos Gerais: Total": gastosGerais(0),
  ...Object.fromEntries(
    ["MO Direta", "MO Indireta", "MO Geral"].flatMap((q) => [
      [`Quadro de Lotação: ${q} Matriz`, importado(`Quadro de Lotação: ${q} Matriz`)],
      [`Quadro de Lotação: ${q} Filial`, importado(`Quadro de Lotação: ${q} Filial`)],
      [`Quadro de Lotação: ${q} Total`, importado(`Quadro de Lotação: ${q} Total`)],
      [`Eficiência da Produção: ${q} Matriz`, porColaborador(producao(1), (m) => lotacao(m, `${q} Matriz`))],
      [`Eficiência da Produção: ${q} Filial`, porColaborador(producao(2), (m) => lotacao(m, `${q} Filial`))],
      [`Eficiência da Produção: ${q} Total`, porColaborador(producao(0), (m) => lotacao(m, `${q} Total`))],
      [`Quadro de Lotação: ${q} Montagem`, importado(`Quadro de Lotação: ${q} Montagem`)],
      [`Eficiência da Montagem: ${q}`, porColaborador(rendimento, (m) => lotacao(m, `${q} Montagem`))],
      [`Eficiência da Operação: ${q} Matriz`, porColaborador(receitaProducao(1), (m) => lotacao(m, `${q} Matriz`), 1000)],
      [`Eficiência da Operação: ${q} Filial`, porColaborador(receitaProducao(2), (m) => lotacao(m, `${q} Filial`), 1000)],
      [`Eficiência da Operação: ${q} Total`, operacaoTotal(q)],
      [`Eficiência da Operação: ${q} Montagem`, porColaborador((m) => m.dre(0, COD.RLM), (m) => lotacao(m, `${q} Montagem`), 1000)],
    ]),
  ),
  "Eficiência da Operação: Total": porColaborador((m) => m.dre(0, COD.RO), (m) => m.importado("Quadro de Lotação Total") ?? NaN, 1000),
  "Custos de Serviços: Montagem (CSM)": razao(3, [L.CSM], COD.RLM),
  "Rendimento: Montagem": v(3, COD.MONTAGEM),
  "Mão de Obra Direta: Montagem": razao(3, [L.CSM_MOD, L.CSM_MOT], COD.MONTAGEM),
  "Custos e Manutenção: Guindastes": razao(3, [L.MANUTENCAO, L.LOCACAO], COD.MONTAGEM),
  "Custos de Frete: Matriz (DVV)": v(1, COD.FRETE),
  "Custos de Frete: Filial (DVV)": v(2, COD.FRETE),
  "Custos de Frete: Total (DVV)": v(0, COD.FRETE),
  "Despesas de Logística (DL)": razao(0, [L.DL], COD.RO),
  "Expedição (Vol.): Matriz": v(1, L.EXPEDICAO),
  "Expedição (Vol.): Filial": v(2, L.EXPEDICAO),
  "Expedição (Vol.): Total": v(0, L.EXPEDICAO),
  "Despesas Técnicas (DT)": razao(0, [L.DT], COD.RO),
  "Liberação de Projetos: Matriz": projetos("PROJETOS_MATRIZ"),
  "Liberação de Projetos: Filial": projetos("PROJETOS_FILIAL"),
  "Liberação de Projetos: Total": projetos("PROJETOS_MATRIZ", "PROJETOS_FILIAL"),
  "Comissões de Representantes e 3os (DVV)": v(0, L.COMISSOES),
  "Despesas Comerciais (DC)": razao(0, [L.DC], COD.RO),
  ...Object.fromEntries(
    ["Global", "Mercantil", "Total"].flatMap((t) => [
      [`Venda: ${t}`, importado(`Venda: ${t}`)],
      [`Receita Líquida Vendida: ${t}`, importado(`Receita Líquida Vendida: ${t}`)],
      // A margem das vendas acumula ponderada pela venda (células Q65 a Q67 da aba Realizado).
      [`Margem de Contribuição: ${t}`, importado(`Margem de Contribuição: ${t}`, venda(t))],
    ]),
  ),
  "Demanda (Vol.): Matriz": importado("Demanda (Vol.): Matriz"),
  "Demanda (Vol.): Filial": importado("Demanda (Vol.): Filial"),
  "Demanda (Vol.): Total (Fabricação)": importado("Demanda (Vol.): Total (Fabricação)"),
  "Demanda (Vol.): Montagem": importado("Demanda (Vol.): Montagem"),
  "Demanda (Pistas.): Filial": importado("Demanda (Pistas.): Filial"),
  "Despesas Administrativas (DA)": razao(0, [L.DA], COD.RO),
  "Fluxo de Caixa Operacional Líquido": importado("Fluxo de Caixa Operacional Líquido"),
  "Inadimplência": importado("Inadimplência"),
  "Quadro de Lotação Total": importado("Quadro de Lotação Total"),
  // O turnover acumula ponderado pelo quadro de lotação (célula Q77 da aba Realizado).
  "Turnover": importado("Turnover", (m) => m.importado("Quadro de Lotação Total")),
  "Abertura de Vagas x Contratações": importado("Abertura de Vagas x Contratações"),
  "Acidentes c/ Afastamento": importado("Acidentes c/ Afastamento"),
  "Receita Líquida: Produção Matriz": v(1, COD.RLPF),
  "Receita Líquida: Produção Filial": v(2, COD.RLPF),
  "Receita Líquida: Frete Matriz": v(1, COD.RLF),
  "Receita Líquida: Frete Filial": v(2, COD.RLF),
  "Receita Líquida: Devoluções e Inventários": v(0, COD.RLDI),
  "Receita Líquida: Montagem": v(0, COD.RLM),
  "Receita Líquida: Complementares": v(0, COD.RLC),
  "Receita Líquida: Produção": (m) => ({ valor: finito(m.dre(1, COD.RO) + m.dre(2, COD.RO)) }),
  "Receita Líquida: Serviços": v(3, COD.RO),
  "Receita Líquida: Total": v(0, COD.RO),
  "Margem Bruta (MB): Matriz": v(1, L.MB),
  "Margem Bruta (MB): Filial": v(2, L.MB),
  "Margem Bruta (MB): Serviços": v(3, L.MB),
  "Margem Bruta (MB): Total": v(0, L.MB),
  "Margem de Contribuição (MC): Total": v(0, L.MC),
  "Lucro Operacional (EBITDA)": v(0, L.EBITDA),
  "Resultado Financeiro (RF)": (m) => ({ valor: finito(m.dre(0, L.RF) - m.dre(0, L.DF)) }),
  "Resultado Líquido (RL)": v(0, L.RL),
  // O mix acumula ponderado pela venda total (célula Q111 da aba Realizado).
  "Repres. do Mix Ampliado nas Vendas": importado("Repres. do Mix Ampliado nas Vendas", venda("Total")),
  "Média Móvel da Demanda Gerada": sobreCapacidade((m) => m.importado("Demanda (Vol.): Total (Fabricação)"), (m) => m.importado("Venda: Total")),
  "Média Móvel da Demanda Expedida": sobreCapacidade((m) => finito(m.dre(0, L.EXPEDICAO)), (m) => finito(m.dre(0, L.EXPEDICAO))),
  "Atingimento do FCOL Acumulado": atingimentoAcumulado("Fluxo de Caixa Operacional Líquido"),
  "Atingimento da MC Acumulada": atingimentoAcumulado("Margem de Contribuição (MC): Total"),
};

type Tupla = [grupo: string, numero: string, nome: string, sentido: string, unidade: string, metodologia: string, acumulado: "ACUM" | "ATUAL"];
// prettier-ignore
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
  ["Geral", "1", "Margem Bruta (MB): Matriz", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "1", "Margem Bruta (MB): Filial", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "1", "Margem Bruta (MB): Serviços", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "1", "Margem Bruta (MB): Total", "↑", "R$", "Margem Bruta", "ACUM"],
  ["Geral", "2", "Margem de Contribuição (MC): Total", "↑", "R$", "Margem de Contribuição", "ACUM"],
  ["Geral", "3", "Lucro Operacional (EBITDA)", "↑", "R$", "EBITDA", "ACUM"],
  ["Geral", "4", "Resultado Financeiro (RF)", "↑", "R$", "Receitas Financeiras - Despesas Financeiras", "ACUM"],
  ["Geral", "5", "Resultado Líquido (RL)", "↑", "R$", "Resultado Líquido", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Direta Matriz", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Direta Filial", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Direta Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Indireta Matriz", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Indireta Filial", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Indireta Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Geral Matriz", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Geral Filial", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "6", "Eficiência da Operação: MO Geral Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Direta Montagem", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Indireta Montagem", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "7", "Eficiência da Operação: MO Geral Montagem", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["Geral", "8", "Eficiência da Operação: Total", "↑", "R$ (K)/colab.", "Receita Líquida / Colaboradores", "ACUM"],
  ["GME", "GME 3", "Repres. do Mix Ampliado nas Vendas", "↑", "%", "Venda Complementar / Venda Total", "ACUM"],
  // Os GME 4 e 8, das linhas 112 a 115 da aba Realizado (11/10/2026); não estão na Realizado (SIG).
  ["GME", "GME 4", "Média Móvel da Demanda Gerada", "↑", "%", "Demanda Gerada / Capacidade de Produção (Global)", "ACUM"],
  ["GME", "GME 4", "Média Móvel da Demanda Expedida", "↑", "%", "Demanda Expedida / Capacidade de Produção (Global)", "ACUM"],
  ["GME", "GME 8", "Atingimento do FCOL Acumulado", "↑", "%", "Realizado / Orçado", "ATUAL"],
  ["GME", "GME 8", "Atingimento da MC Acumulada", "↑", "%", "Realizado / Orçado", "ATUAL"],
];

export const INDICADORES: Indicador[] = LISTA.map(([grupo, numero, nome, sentido, unidade, metodologia, acumulado]) => ({
  grupo,
  numero,
  nome,
  sentido,
  unidade,
  metodologia,
  acumulado,
  calculo: CALCULOS[nome],
}));

/** O acumulado dos meses (as partes de cada mês, em ordem; null no mês sem dado). */
export function acumular(i: Pick<Indicador, "acumulado">, partes: Array<Parte | null>): number | null {
  const comDado = partes.filter((p): p is Parte => p !== null && (p.valor !== null || !!p.componentes));
  if (comDado.length === 0) return null;
  if (i.acumulado === "ATUAL") return comDado[comDado.length - 1].valor;
  const itens = comDado.flatMap((p): Array<{ valor: number | null; peso?: number }> => p.componentes ?? [p]).filter((p) => p.valor !== null);
  if (itens.every((p) => p.peso === undefined)) return itens.reduce((s, p) => s + p.valor!, 0);
  const pesados = itens.filter((p) => p.peso !== undefined && Number.isFinite(p.peso));
  const soma = pesados.reduce((s, p) => s + p.peso!, 0);
  return soma === 0 ? null : pesados.reduce((s, p) => s + p.valor! * p.peso!, 0) / soma;
}
