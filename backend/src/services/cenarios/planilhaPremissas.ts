import { unzipSync } from "fflate";

import { ArquivoInvalidoError, lerAba, listarAbas, type ValorCelula } from "../../lib/xlsx.js";
import { coluna, ESTILO, type AbaEscrita, type Celula } from "../../lib/xlsxEscrita.js";
import { juntarOrigem, type OrigensDasContas } from "./consolidadoDosCentros.js";
import { CONTAS_DEPRECIACAO, depreciacaoMensal, roi } from "./investimentosCenario.js";

/**
 * A planilha das premissas de um cenário analítico (15/10/2026): o Exportar Premissas (só Excel) e o Importar Valores.
 * Cada aba da tela vira uma aba da planilha (os centros de custo numa aba só, um por aba ou um arquivo por centro): a
 * coluna Código (a chave da linha, que não se altera), as colunas que descrevem a linha, a unidade, a Média de
 * Referência, o Total da Referência (a média × 12) e a Variação Máxima da conta (do Comparativo) — 15/10/2026 —, os doze
 * meses (em branco: o mês sem valor), Justificar? (uma fórmula: Sim quando o total dos doze meses passa da variação
 * máxima em relação ao Total da Referência) e a Justificativa (texto livre). O Importar Valores lê os meses e a
 * Justificativa das linhas pela coluna Código; as colunas da referência e Justificar? não se importam. A aba
 * Investimentos (15/10/2026) traz a lista dos investimentos, com as listas suspensas da Unidade e da Conta e as fórmulas
 * da Depreciação Mensal e do ROI; importada, atualiza os investimentos pelo Nome de Referência e inclui os de nome novo.
 */

export type AbaDasPremissas = "1" | "2" | "3" | "centros" | "investimentos" | "extra" | "manuais";
export const ABAS_DAS_PREMISSAS: AbaDasPremissas[] = ["1", "2", "3", "centros", "investimentos", "extra", "manuais"];
export const NOME_DA_ABA: Record<AbaDasPremissas, string> = {
  "1": "Matriz",
  "2": "Filial",
  "3": "Serviços",
  centros: "Centros de Custo",
  investimentos: "Depreciação Base",
  extra: "Extra-Operacional",
  manuais: "Indicadores Manuais",
};
/** As colunas que descrevem a linha, em cada aba. */
const COLUNAS: Record<AbaDasPremissas, Array<[string, number]>> = {
  "1": [["Venda", 11], ["Seção", 24], ["Linha", 30], ["Premissa", 44]],
  "2": [["Venda", 11], ["Seção", 24], ["Linha", 30], ["Premissa", 44]],
  "3": [["Venda", 11], ["Seção", 24], ["Linha", 30], ["Premissa", 44]],
  centros: [["Grupo", 28], ["Atribuição", 26], ["Conta", 40]],
  investimentos: [["Unidade", 18], ["Conta", 44]],
  extra: [["Unidade", 18], ["Seção", 30], ["Conta", 44]],
  manuais: [["Grupo", 22], ["Indicador", 44]],
};

export type LinhaDaPlanilha = {
  aba: AbaDasPremissas;
  /** P|unidade|venda|premissa, C|grupo|conta, L|grupo, B|unidade|conta, X|unidade|conta ou I|indicador. */
  chave: string;
  descricao: string[];
  und: string;
  /** A conta da DRE (a variação máxima do Comparativo); nula nas linhas sem conta (volumes, dias úteis, quadros). */
  conta: string | null;
  limite: number | null;
  media: number | null;
  /** Os doze meses gravados; null: em branco. */
  meses: Array<number | null>;
  /** O valor é uma fração (0,25 = 25%): os indicadores em %. */
  percentual?: boolean;
  /** Nos centros de custo, o grupo (para separar os centros em abas ou arquivos). */
  grupo?: string;
  justificativa: string | null;
};

/** A aba das premissas de uma chave da planilha (a permissão de editar é a dela). */
export function abaDaChave(chave: string): AbaDasPremissas | null {
  const [tipo, u] = chave.split("|");
  if (tipo === "P") return u === "1" || u === "2" || u === "3" ? u : null;
  return ({ C: "centros", L: "centros", B: "investimentos", X: "extra", I: "manuais" } as const)[tipo as "C"] ?? null;
}

/**
 * Os departamentos do Exportar Premissas (15/10/2026): o arquivo leva só o que é dos marcados. Produção: Matriz, Filial,
 * os centros de custo de produção (CPP) e a depreciação base e os investimentos da Matriz e da Filial; Serviços: a aba
 * Serviços, os centros de serviços (CSM e CSC) e a depreciação e os investimentos de Serviços; Logística, Técnico,
 * Comercial e Administrativo: os centros do departamento (DL, DT, DC e DA); Extra-Operacional: a aba Extra-Operacional.
 * Esses cinco levam também a depreciação base e os investimentos de Despesas e Extra (o patrimônio). Os indicadores
 * manuais vão pelo grupo deles (o GME, que é das vendas, com o Comercial; o Geral, com o Administrativo).
 */
export type Departamento = "PRODUCAO" | "SERVICOS" | "LOGISTICA" | "TECNICO" | "COMERCIAL" | "ADMINISTRATIVO" | "EXTRA";
export const DEPARTAMENTOS: Array<{ chave: Departamento; nome: string }> = [
  { chave: "PRODUCAO", nome: "Produção" },
  { chave: "SERVICOS", nome: "Serviços" },
  { chave: "LOGISTICA", nome: "Logística" },
  { chave: "TECNICO", nome: "Técnico" },
  { chave: "COMERCIAL", nome: "Comercial" },
  { chave: "ADMINISTRATIVO", nome: "Administrativo" },
  { chave: "EXTRA", nome: "Extra-Operacional" },
];
const DO_PATRIMONIO: Departamento[] = ["LOGISTICA", "TECNICO", "COMERCIAL", "ADMINISTRATIVO", "EXTRA"];
const DO_GRUPO_DRE: Record<string, Departamento> = { CPP: "PRODUCAO", CSM: "SERVICOS", CSC: "SERVICOS", DL: "LOGISTICA", DT: "TECNICO", DC: "COMERCIAL", DA: "ADMINISTRATIVO" };
const DO_GRUPO_DO_INDICADOR: Record<string, Departamento> = {
  Produção: "PRODUCAO",
  Serviços: "SERVICOS",
  Logística: "LOGISTICA",
  Técnico: "TECNICO",
  Comercial: "COMERCIAL",
  GME: "COMERCIAL",
  Administrativo: "ADMINISTRATIVO",
  Geral: "ADMINISTRATIVO",
};

/** Os departamentos de uma unidade (a depreciação base e os investimentos dela). */
export const departamentosDaUnidade = (unidade: number): Departamento[] => (unidade === 1 || unidade === 2 ? ["PRODUCAO"] : unidade === 3 ? ["SERVICOS"] : DO_PATRIMONIO);

/** Os departamentos de uma linha da planilha; `grupoDRE` dá o grupo da DRE de cada grupo de centros. */
export function departamentosDaLinha(l: Pick<LinhaDaPlanilha, "chave" | "descricao">, grupoDRE: Map<string, string | null>): Departamento[] {
  const [tipo, a] = l.chave.split("|");
  if (tipo === "P") return departamentosDaUnidade(Number(a));
  if (tipo === "B") return departamentosDaUnidade(Number(a));
  if (tipo === "X") return ["EXTRA"];
  if (tipo === "C" || tipo === "L") {
    const d = DO_GRUPO_DRE[grupoDRE.get(a) ?? ""];
    return d ? [d] : [];
  }
  if (tipo === "I") {
    const d = DO_GRUPO_DO_INDICADOR[l.descricao[0] ?? ""];
    return d ? [d] : [];
  }
  return [];
}

/**
 * O trecho de uma linha da planilha (15/10/2026), para conferir as abas repetidas ao importar vários arquivos: a
 * unidade, o centro de custo, a depreciação base da unidade, o extra-operacional ou o grupo dos indicadores manuais.
 */
export function blocoDaChave(chave: string, descricao: string[] = []) {
  const [tipo, a, b] = chave.split("|");
  if (tipo === "P") return NOME_DA_ABA[a as "1"] ?? "Premissas";
  if (tipo === "C" || tipo === "L") return `Centro de Custo: ${a}`;
  if (tipo === "B") return `Depreciação Base: ${CONTAS_DEPRECIACAO.find((c) => String(c.unidade) === a)?.nomeUnidade ?? a}`;
  if (tipo === "X") return `Extra-Operacional: ${a === "5" ? "RN" : "Despesas e Extra"}`;
  if (tipo === "I") return `Indicadores Manuais${descricao[0] ? `: ${descricao[0]}` : ""}`;
  return b ?? chave;
}

export const COLUNA_CODIGO = "Código (não altere)";
const COLUNA_MEDIA = "Média de Referência";
const COLUNA_TOTAL_REFERENCIA = "Total da Referência";
const COLUNA_VARIACAO = "Variação Máxima (%)";
const COLUNA_JUSTIFICAR = "Justificar?";
const COLUNA_JUSTIFICATIVA = "Justificativa";

/**
 * Justificar? (15/10/2026; antes, mês a mês): Sim quando o total dos doze meses (os em branco valem zero) passa da
 * variação máxima da conta em relação ao Total da Referência (a Média de Referência × 12); com o Total da Referência
 * zero, Sim quando o total não é zero. Sem média, sem variação máxima ou sem conta, Não. A planilha leva a mesma conta
 * em fórmula; esta dá o valor que o arquivo mostra antes de o Excel recalcular.
 */
export function precisaJustificar(l: Pick<LinhaDaPlanilha, "limite" | "media" | "meses">) {
  if (l.limite === null || l.media === null) return false;
  const total = l.meses.reduce<number>((s, v) => s + (v ?? 0), 0);
  const referencia = l.media * 12;
  if (Math.abs(referencia) < 0.005) return Math.abs(total) >= 0.005;
  return Math.round((Math.abs(total - referencia) / Math.abs(referencia)) * 10000) / 100 > l.limite;
}

/** Uma aba da planilha: o título, a explicação, os rótulos e as linhas. */
export function abaDaPlanilha(nome: string, aba: AbaDasPremissas, linhas: LinhaDaPlanilha[], meses: string[], identificacao: string): AbaEscrita {
  const cab = (valor: string): Celula => ({ valor, estilo: ESTILO.cabecalho });
  const cabDireita = (valor: string): Celula => ({ valor, estilo: ESTILO.cabecalhoDireita });
  const numero = (l: LinhaDaPlanilha, v: number | null): Celula => ({ valor: v, estilo: l.percentual ? ESTILO.itemPercentual : ESTILO.itemNumero });
  // As colunas (a partir de 0): o Código, as descrições, a Und., a Média, o Total da Referência, a Variação Máxima, os
  // doze meses, Justificar? e a Justificativa.
  const n = COLUNAS[aba].length;
  const [cMedia, cTotal, cVariacao, cJan, cDez] = [n + 2, n + 3, n + 4, n + 5, n + 16].map(coluna);
  return {
    nome,
    larguras: [30, ...COLUNAS[aba].map(([, w]) => w), 10, 14, 14, 12, ...meses.map(() => 13), 12, 60],
    linhas: [
      [{ valor: `Premissas · ${nome}`, estilo: ESTILO.titulo }],
      [{ valor: identificacao, estilo: ESTILO.informacao }],
      [
        {
          valor:
            "Preencha os meses e a Justificativa e importe o arquivo em Premissas / Importar Valores. Em branco, o mês fica sem valor. A coluna Código identifica a linha: não a altere. Justificar? é Sim quando o total dos doze meses passa da Variação Máxima em relação ao Total da Referência (a Média de Referência × 12). A Média, o Total da Referência, a Variação Máxima e Justificar? não se importam.",
          estilo: ESTILO.informacao,
        },
      ],
      [],
      [
        cab(COLUNA_CODIGO),
        ...COLUNAS[aba].map(([c]) => cab(c)),
        cab("Und."),
        cabDireita(COLUNA_MEDIA),
        cabDireita(COLUNA_TOTAL_REFERENCIA),
        cabDireita(COLUNA_VARIACAO),
        ...meses.map(cabDireita),
        cab(COLUNA_JUSTIFICAR),
        cab(COLUNA_JUSTIFICATIVA),
      ],
      ...linhas.map((l, i): Celula[] => {
        const r = PRIMEIRA_LINHA + i;
        const soma = `SUM(${cJan}${r}:${cDez}${r})`;
        const [m, t, v] = [`${cMedia}${r}`, `${cTotal}${r}`, `${cVariacao}${r}`];
        return [
          { valor: l.chave },
          ...l.descricao.map((d) => ({ valor: d })),
          { valor: l.und },
          numero(l, l.media),
          { ...numero(l, l.media === null ? null : l.media * 12), formula: `IF(${m}="","",${m}*12)` },
          { valor: l.limite, estilo: ESTILO.itemNumero },
          ...l.meses.map((x) => numero(l, x)),
          {
            valor: precisaJustificar(l) ? "Sim" : "Não",
            formula: `IF(OR(${m}="",${v}=""),"Não",IF(ABS(${t})<0.005,IF(ABS(${soma})<0.005,"Não","Sim"),IF(ROUND(ABS(${soma}-${t})/ABS(${t})*100,2)>${v},"Sim","Não")))`,
          },
          { valor: l.justificativa },
        ];
      }),
    ],
    linhaCabecalho: 5,
    rodape: `Premissas · ${nome}`,
    paisagem: true,
  };
}

/** A linha da primeira linha de valores nas abas da planilha (abaDaPlanilha: o título, a identificação, a explicação, uma em branco e os rótulos). */
const PRIMEIRA_LINHA = 6;

/**
 * As contas de uma aba de centros da planilha (15/10/2026), para o Consolidado: as linhas das contas (C|grupo|conta) e as
 * colunas da Média de Referência e dos doze meses. `aba` é o nome final da aba no arquivo.
 */
export function origensDaAba(origens: OrigensDasContas, aba: string, linhas: LinhaDaPlanilha[]) {
  const iMedia = 1 + COLUNAS.centros.length + 1;
  // A Média de Referência e os meses (depois do Total da Referência e da Variação Máxima).
  const colunas = [coluna(iMedia), ...Array.from({ length: 12 }, (_, k) => coluna(iMedia + 3 + k))];
  linhas.forEach((l, i) => {
    if (l.chave.startsWith("C|") && l.conta) juntarOrigem(origens, l.conta, { aba, linha: PRIMEIRA_LINHA + i, colunas, valores: [l.media, ...l.meses] });
  });
}

/** O nome da aba Consolidado: o Importar Valores a ignora sem aviso. */
export const ABA_CONSOLIDADO = "Consolidado";

/** Uma linha lida de um arquivo: a chave, os doze meses (null: em branco) e a justificativa. */
export type LinhaLida = { aba: string; numero: number; chave: string; meses: Array<number | null>; justificativa: string | null };
/** Um investimento lido da aba Investimentos: o Nome de Referência (o do investimento a atualizar, ou o de um novo) e os campos, já validados. */
export type InvestimentoLido = {
  aba: string;
  numero: number;
  nomeReferencia: string;
  unidade: number;
  descricao: string;
  ganhoPrevisto: string | null;
  receitaBrutaPrevista: number | null;
  inicio: number;
  valorTotal: number;
  valorPosUso: number;
  vidaUtil: number;
};
export type ArquivoLido = { arquivo: string; linhas: LinhaLida[]; investimentos: InvestimentoLido[]; abas: string[]; erros: string[]; avisos: string[] };

/** O número de uma célula: o do Excel ou um texto no formato brasileiro ("1.234,5", "25%"); vazio, null; inválido, undefined. */
function numeroDa(v: ValorCelula): number | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return undefined;
  const t = v.trim();
  if (!t) return null;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/%$/, "").replace(/R\$|\s/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  return pct ? n / 100 : n;
}

/** O nome da aba da lista dos investimentos (15/10/2026). */
export const ABA_INVESTIMENTOS = "Investimentos";
/** As colunas da aba Investimentos (a partir de A). */
/** A primeira coluna da aba Investimentos (15/10/2026; antes, o Código). */
const COLUNA_NOME_REFERENCIA = "Nome de Referência";
const COLUNAS_INVESTIMENTOS: Array<[string, number]> = [
  [COLUNA_NOME_REFERENCIA, 30],
  ["Unidade", 18],
  ["Conta", 36],
  ["Descrição", 40],
  ["Ganho Previsto", 30],
  ["Receita Bruta Prevista", 18],
  ["Mês de Início (1 a 12)", 12],
  ["Valor Total", 16],
  ["Valor Pós Uso", 16],
  ["Vida Útil (meses)", 12],
  ["Depreciação Mensal", 16],
  ["ROI (%)", 10],
];
/** As linhas em branco, com as fórmulas e as listas, para incluir investimentos novos na planilha. */
const LINHAS_NOVAS = 30;

export type InvestimentoDaPlanilha = Omit<InvestimentoLido, "aba" | "numero"> & { id: string };

/**
 * A aba Investimentos (15/10/2026): os investimentos das unidades escolhidas, com o Nome de Referência (que identifica o
 * investimento na importação), a Unidade e a Conta em listas suspensas, os campos do investimento e, em fórmulas, a
 * Depreciação Mensal ((valor total − valor pós uso) ÷ vida útil) e o ROI ((receita bruta prevista − valor total) ÷ valor
 * total). Abaixo, linhas em branco para os investimentos novos.
 */
export function abaDeInvestimentos(investimentos: InvestimentoDaPlanilha[], identificacao: string): AbaEscrita {
  const cab = (valor: string, direita = false): Celula => ({ valor, estilo: direita ? ESTILO.cabecalhoDireita : ESTILO.cabecalho });
  const nomeDaUnidade = (u: number) => CONTAS_DEPRECIACAO.find((c) => c.unidade === u)?.nomeUnidade ?? "";
  const rotuloDaConta = (u: number) => CONTAS_DEPRECIACAO.find((c) => c.unidade === u)?.rotulo ?? "";
  const formulas = (r: number) => ({
    depreciacao: `IF(OR(H${r}="",J${r}="",J${r}=0),"",(H${r}-IF(I${r}="",0,I${r}))/J${r})`,
    roi: `IF(OR(F${r}="",H${r}="",H${r}=0),"",(F${r}-H${r})/H${r})`,
  });
  const linhas: Celula[][] = [
    [{ valor: `Premissas · ${ABA_INVESTIMENTOS}`, estilo: ESTILO.titulo }],
    [{ valor: identificacao, estilo: ESTILO.informacao }],
    [
      {
        valor:
          "Altere os investimentos ou inclua novos nas linhas em branco e importe o arquivo em Premissas / Importar Valores: com o Nome de Referência de um investimento do cenário, ele é atualizado; com um nome novo, é incluído (o nome não se repete no cenário). A Depreciação Mensal e o ROI são fórmulas e não se importam.",
        estilo: ESTILO.informacao,
      },
    ],
    [],
    COLUNAS_INVESTIMENTOS.map(([c], k) => cab(c, k >= 5 && k !== 4)),
  ];
  investimentos.forEach((i, k) => {
    const r = PRIMEIRA_LINHA + k;
    const f = formulas(r);
    linhas.push([
      { valor: i.nomeReferencia },
      { valor: nomeDaUnidade(i.unidade) },
      { valor: rotuloDaConta(i.unidade) },
      { valor: i.descricao },
      { valor: i.ganhoPrevisto },
      { valor: i.receitaBrutaPrevista, estilo: ESTILO.itemNumero },
      { valor: i.inicio },
      { valor: i.valorTotal, estilo: ESTILO.itemNumero },
      { valor: i.valorPosUso, estilo: ESTILO.itemNumero },
      { valor: i.vidaUtil },
      { valor: Math.round(depreciacaoMensal(i) * 100) / 100, estilo: ESTILO.itemNumero, formula: f.depreciacao },
      { valor: roi(i) === null ? null : roi(i)! / 100, estilo: ESTILO.itemPercentual, formula: f.roi },
    ]);
  });
  for (let k = 0; k < LINHAS_NOVAS; k++) {
    const r = PRIMEIRA_LINHA + investimentos.length + k;
    const f = formulas(r);
    linhas.push([
      ...Array.from({ length: 10 }, (): Celula => ({ valor: null })),
      { valor: null, estilo: ESTILO.itemNumero, formula: f.depreciacao },
      { valor: null, estilo: ESTILO.itemPercentual, formula: f.roi },
    ]);
  }
  const ultima = PRIMEIRA_LINHA + investimentos.length + LINHAS_NOVAS - 1;
  const intervalo = (c: string) => `${c}${PRIMEIRA_LINHA}:${c}${ultima}`;
  return {
    nome: ABA_INVESTIMENTOS,
    larguras: COLUNAS_INVESTIMENTOS.map(([, w]) => w),
    linhas,
    linhaCabecalho: 5,
    rodape: `Premissas · ${ABA_INVESTIMENTOS}`,
    paisagem: true,
    validacoes: [
      { celulas: intervalo("B"), lista: CONTAS_DEPRECIACAO.map((c) => c.nomeUnidade) },
      { celulas: intervalo("C"), lista: [...new Set(CONTAS_DEPRECIACAO.map((c) => c.rotulo))] },
      { celulas: intervalo("G"), inteiro: [1, 12] },
      { celulas: intervalo("J"), inteiro: [1, 600] },
    ],
  };
}

/** Lê a aba Investimentos: as linhas com algum campo (a Depreciação Mensal e o ROI, fórmulas, não contam). */
function lerInvestimentos(nome: string, linhas: Array<{ numero: number; celulas: ValorCelula[] }>, i: number, r: ArquivoLido) {
  const rotulos = linhas[i].celulas.map((c) => String(c ?? "").trim());
  const col = (rotulo: string) => rotulos.indexOf(rotulo);
  const iCampos = COLUNAS_INVESTIMENTOS.slice(0, 10).map(([c]) => col(c));
  if (iCampos.some((x) => x < 0)) {
    r.erros.push(`A aba ${nome} não tem as colunas do padrão (${COLUNAS_INVESTIMENTOS.slice(0, 10).map(([c]) => `“${c}”`).join(", ")}).`);
    return;
  }
  const [iNome, iUnidade, iConta, iDescricao, iGanho, iReceita, iInicio, iTotal, iPosUso, iVida] = iCampos;
  const texto = (v: ValorCelula | undefined) => (v === null || v === undefined ? "" : String(v).trim());
  const nomes = new Set<string>();
  r.abas.push(nome);
  for (const l of linhas.slice(i + 1)) {
    const c = l.celulas;
    if (iCampos.every((k) => texto(c[k]) === "")) continue;
    const erro = (m: string) => r.erros.push(`${nome}, linha ${l.numero}: ${m}`);
    const nomeReferencia = texto(c[iNome]).slice(0, 80);
    if (!nomeReferencia) {
      erro("dê um Nome de Referência ao investimento.");
      continue;
    }
    if (nomes.has(nomeReferencia.toLocaleLowerCase("pt-BR"))) {
      erro(`o Nome de Referência “${nomeReferencia}” se repete na aba.`);
      continue;
    }
    nomes.add(nomeReferencia.toLocaleLowerCase("pt-BR"));
    const unidade = CONTAS_DEPRECIACAO.find((x) => x.nomeUnidade.toLocaleLowerCase("pt-BR") === texto(c[iUnidade]).toLocaleLowerCase("pt-BR"));
    if (!unidade) {
      erro(`a Unidade “${texto(c[iUnidade])}” não é uma das da lista (${CONTAS_DEPRECIACAO.map((x) => x.nomeUnidade).join(", ")}).`);
      continue;
    }
    const conta = texto(c[iConta]);
    if (conta && conta.toLocaleLowerCase("pt-BR") !== unidade.rotulo.toLocaleLowerCase("pt-BR")) {
      erro(`a Conta de ${unidade.nomeUnidade} é a ${unidade.rotulo} (está “${conta}”).`);
      continue;
    }
    const descricao = texto(c[iDescricao]).slice(0, 200);
    if (!descricao) {
      erro("descreva o investimento.");
      continue;
    }
    const num = (k: number, rotulo: string) => {
      const v = numeroDa(c[k] ?? null);
      if (v === undefined) erro(`${rotulo}: “${texto(c[k])}” não é um número.`);
      return v;
    };
    const receita = num(iReceita, "Receita Bruta Prevista");
    const inicio = num(iInicio, "Mês de Início");
    const total = num(iTotal, "Valor Total");
    const posUso = num(iPosUso, "Valor Pós Uso");
    const vida = num(iVida, "Vida Útil");
    if ([receita, inicio, total, posUso, vida].includes(undefined)) continue;
    if (inicio === null || inicio === undefined || !Number.isInteger(inicio) || inicio < 1 || inicio > 12) {
      erro("o Mês de Início vai de 1 a 12.");
      continue;
    }
    if (total === null || total! <= 0) {
      erro("o Valor Total precisa ser maior que zero.");
      continue;
    }
    if (vida === null || !Number.isInteger(vida) || vida! < 1 || vida! > 600) {
      erro("a Vida Útil é um número inteiro de meses, de 1 a 600.");
      continue;
    }
    if ((posUso ?? 0) < 0 || (posUso ?? 0) > total!) {
      erro("o Valor Pós Uso vai de zero ao Valor Total.");
      continue;
    }
    if (receita !== null && receita! < 0) {
      erro("a Receita Bruta Prevista não pode ser negativa.");
      continue;
    }
    r.investimentos.push({
      aba: nome,
      numero: l.numero,
      nomeReferencia,
      unidade: unidade.unidade,
      descricao,
      ganhoPrevisto: texto(c[iGanho]).slice(0, 500) || null,
      receitaBrutaPrevista: receita ?? null,
      inicio: inicio!,
      valorTotal: total!,
      valorPosUso: posUso ?? 0,
      vidaUtil: vida!,
    });
  }
}

/** Lê um .xlsx do Exportar Premissas: as abas com a coluna Código; as outras são ignoradas, com um aviso. */
function lerXlsx(arquivo: string, buffer: Uint8Array): ArquivoLido {
  const r: ArquivoLido = { arquivo, linhas: [], investimentos: [], abas: [], erros: [], avisos: [] };
  let abas: string[];
  try {
    abas = listarAbas(buffer);
  } catch (e) {
    r.erros.push(e instanceof ArquivoInvalidoError ? e.message : "O arquivo não é uma planilha do Excel (.xlsx) legível.");
    return r;
  }
  for (const nome of abas) {
    if (nome === ABA_CONSOLIDADO) continue;
    const { linhas } = lerAba(buffer, () => nome);
    const i = linhas.findIndex((l) => [COLUNA_CODIGO, COLUNA_NOME_REFERENCIA].includes(String(l.celulas[0] ?? "").trim()));
    if (i < 0) {
      r.avisos.push(`A aba ${nome} não está no padrão do Exportar Premissas (sem a coluna “${COLUNA_CODIGO}”) e foi ignorada.`);
      continue;
    }
    const rotulos = linhas[i].celulas.map((c) => String(c ?? "").trim());
    // A aba Investimentos (15/10/2026): pelo Nome de Referência na primeira coluna.
    if (rotulos[0] === COLUNA_NOME_REFERENCIA) {
      lerInvestimentos(nome, linhas, i, r);
      continue;
    }
    const iMedia = rotulos.indexOf(COLUNA_MEDIA);
    // Os meses vêm depois da Variação Máxima (15/10/2026); nos arquivos de antes, logo depois da Média de Referência.
    const iVariacao = rotulos.indexOf(COLUNA_VARIACAO);
    const iJan = iVariacao > iMedia ? iVariacao + 1 : iMedia + 1;
    const iJustificativa = rotulos.indexOf(COLUNA_JUSTIFICATIVA);
    if (iMedia < 0 || iJustificativa < 0 || iJustificativa < iJan + 12) {
      r.erros.push(`A aba ${nome} não tem as colunas do padrão (“${COLUNA_MEDIA}”, os doze meses e “${COLUNA_JUSTIFICATIVA}”).`);
      continue;
    }
    r.abas.push(nome);
    for (const l of linhas.slice(i + 1)) {
      const chave = String(l.celulas[0] ?? "").trim();
      if (!chave) continue;
      const meses: Array<number | null> = [];
      for (let k = 0; k < 12; k++) {
        const v = numeroDa(l.celulas[iJan + k] ?? null);
        if (v === undefined) {
          r.erros.push(`${nome}, linha ${l.numero}, ${rotulos[iJan + k] || `mês ${k + 1}`}: “${l.celulas[iJan + k]}” não é um número.`);
          meses.push(null);
        } else meses.push(v);
      }
      const j = l.celulas[iJustificativa];
      r.linhas.push({ aba: nome, numero: l.numero, chave, meses, justificativa: j === null || j === undefined || String(j).trim() === "" ? null : String(j).trim().slice(0, 2000) });
    }
  }
  if (!r.abas.length && !r.erros.length) r.erros.push(`O arquivo não está no padrão do Exportar Premissas: nenhuma aba tem a coluna “${COLUNA_CODIGO}”.`);
  return r;
}

/** Lê um arquivo do Importar Valores: um .xlsx, ou um .zip (o "um arquivo por centro") com os .xlsx dentro. */
export function lerArquivoDePremissas(arquivo: string, buffer: Uint8Array): ArquivoLido[] {
  if (/\.zip$/i.test(arquivo)) {
    let itens: Record<string, Uint8Array>;
    try {
      itens = unzipSync(buffer);
    } catch {
      return [{ arquivo, linhas: [], investimentos: [], abas: [], erros: ["O arquivo .zip não pôde ser aberto."], avisos: [] }];
    }
    const xlsx = Object.entries(itens).filter(([n]) => /\.xlsx$/i.test(n) && !n.startsWith("__MACOSX"));
    if (!xlsx.length) return [{ arquivo, linhas: [], investimentos: [], abas: [], erros: ["O .zip não tem nenhuma planilha (.xlsx)."], avisos: [] }];
    return xlsx.map(([n, b]) => lerXlsx(`${arquivo} › ${n.split("/").pop()}`, b));
  }
  return [lerXlsx(arquivo, buffer)];
}
