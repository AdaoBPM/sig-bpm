import { COD } from "./basesResultados.js";

/**
 * Os indicadores de resultado, na ordem e com os nomes da aba Realizado (SIG)
 * do SIG BPM 2026 - INDICADORES DE RESULTADO; o sentido, a unidade, a
 * metodologia e o acumulado vêm da aba Metas.
 *
 * O cálculo de cada mês sai da DRE apurada (por unidade) e dos volumes
 * congelados da apuração. Conferido contra a aba Realizado (SIG) em
 * 08/10/2026: igual em todos os meses cujos dados não mudaram desde a cópia
 * para a planilha. Os indicadores sem fonte na ferramenta (quadro de lotação,
 * vendas, demanda, fluxo de caixa, inadimplência, turnover, vagas, acidentes)
 * ficam listados, sem valor.
 *
 * Acumulado: ACUM soma os meses — nos indicadores de razão (%, R$/m³), a soma
 * dos numeradores sobre a soma dos denominadores, que é a média ponderada da
 * planilha (SUMPRODUCT); ATUAL é o valor do último mês.
 */

/** Os valores de um mês: a DRE apurada de uma visão (0 Consolidado, 1..5 as unidades) e os volumes congelados. */
export type DadosDoMes = { dre: (unidade: number, codigo: string) => number; volume: (origem: string) => number };
/** O indicador do mês: o numerador e, nas razões, o denominador. */
export type Parte = { num: number; den?: number };
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
  calculo?: Calculo;
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

// Matriz é a unidade 1, Filial a 2, Serviços a 3; o Consolidado (Total) é a 0.
const v = (u: number, c: string): Calculo => (m) => ({ num: m.dre(u, c) });
const razao = (u: number, num: string[], den: string): Calculo => (m) => ({ num: num.reduce((s, c) => s + m.dre(u, c), 0), den: m.dre(u, den) });
const maoDeObra = (u: number) => razao(u, [L.CPP_MOD, L.CPP_MOI, L.FORMAS], COD.PRODUCAO);
const gastosGerais = (u: number) => razao(u, [L.CPP_GGV, L.CPP_GGD, L.CPP_GGI], COD.PRODUCAO);
const projetos = (...origens: string[]): Calculo => (m) => ({ num: origens.reduce((s, o) => s + m.volume(o), 0) });

const CALCULOS: Record<string, Calculo> = {
  "Custos de Produção: Matriz (CPP)": razao(1, [L.CPP], COD.RLPF),
  // Na Filial, sobre a ROL inteira, como na aba Resultados (Filial).
  "Custos de Produção: Filial (CPP)": razao(2, [L.CPP], COD.RO),
  "Custos de Produção: Total (CPP)": razao(0, [L.CPP], COD.RLPF),
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
  "Despesas Administrativas (DA)": razao(0, [L.DA], COD.RO),
  "Receita Líquida: Produção Matriz": v(1, COD.RLPF),
  "Receita Líquida: Produção Filial": v(2, COD.RLPF),
  "Receita Líquida: Frete Matriz": v(1, COD.RLF),
  "Receita Líquida: Frete Filial": v(2, COD.RLF),
  "Receita Líquida: Devoluções e Inventários": v(0, COD.RLDI),
  "Receita Líquida: Montagem": v(0, COD.RLM),
  "Receita Líquida: Complementares": v(0, COD.RLC),
  "Receita Líquida: Produção": (m) => ({ num: m.dre(1, COD.RO) + m.dre(2, COD.RO) }),
  "Receita Líquida: Serviços": v(3, COD.RO),
  "Receita Líquida: Total": v(0, COD.RO),
  "Margem Bruta (MB): Matriz": v(1, L.MB),
  "Margem Bruta (MB): Filial": v(2, L.MB),
  "Margem Bruta (MB): Serviços": v(3, L.MB),
  "Margem Bruta (MB): Total": v(0, L.MB),
  "Margem de Contribuição (MC): Total": v(0, L.MC),
  "Lucro Operacional (EBITDA)": v(0, L.EBITDA),
  "Resultado Financeiro (RF)": (m) => ({ num: m.dre(0, L.RF) - m.dre(0, L.DF) }),
  "Resultado Líquido (RL)": v(0, L.RL),
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

/** O valor de um mês: a razão, ou o próprio valor; null sem denominador. */
export const valorDaParte = (p: Parte) => (p.den === undefined ? p.num : p.den === 0 ? null : p.num / p.den);

/** O acumulado dos meses (as partes de cada mês com dado, em ordem). */
export function acumular(i: Pick<Indicador, "acumulado">, partes: Parte[]): number | null {
  if (partes.length === 0) return null;
  if (i.acumulado === "ATUAL") return valorDaParte(partes[partes.length - 1]);
  const num = partes.reduce((s, p) => s + p.num, 0);
  if (partes.every((p) => p.den === undefined)) return num;
  const den = partes.reduce((s, p) => s + (p.den ?? 0), 0);
  return den === 0 ? null : num / den;
}
