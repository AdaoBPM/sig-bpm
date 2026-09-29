import { strFromU8, unzipSync } from "fflate";

import { ArquivoInvalidoError, lerAba, type ValorCelula } from "../../../lib/xlsx.js";

/**
 * Leitura dos cadastros do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO, fiel à
 * planilha: uma chave por coluna, valores como texto, sem correção. É a mesma
 * forma dos JSON versionados em prisma/carga-inicial/, que são gerados daqui.
 *
 *  - aba Centros de Custo       → centros
 *  - aba Contas de Resultado    → contas
 *  - aba Realizado (Consolidado) → estrutura da DRE (rótulo, fórmula da coluna
 *    de janeiro, departamento, atribuição e observação)
 */

export type LinhaCentroCusto = {
  COLIGADA: string | null;
  "CÓDIGO RM": string | null;
  "CENTRO DE CUSTO (RM)": string | null;
  "CENTRO DE CUSTO (CONTROLADORIA)": string | null;
  DEPARTAMENTO: string | null;
  "DEP.": string | null;
  "ATRIBUIÇÃO": string | null;
  "ATR.": string | null;
  RATEIO: string | null;
};

export type LinhaContaResultado = {
  CD_REDUZIDO: string | null;
  CONTA: string | null;
  DESCRICAO: string | null;
  TIPO_CONTA: string | null;
  DEPARTAMENTO: string | null;
  "DEP.": string | null;
  "ATRIBUIÇÃO": string | null;
  "ATR.": string | null;
  "CONTA DRE": string | null;
  RATEIO: string | null;
};

export type LinhaBrutaDRE = {
  linhaPlanilha: number;
  descricao: string | null;
  formula: string | null;
  grupo: string | null;
  grupoSigla: string | null;
  atribuicao: string | null;
  atribuicaoSigla: string | null;
  definicao: string | null;
};

export type PlanilhaCadastros = {
  centros: LinhaCentroCusto[];
  contas: LinhaContaResultado[];
  dre: LinhaBrutaDRE[];
};

export const ABAS_CADASTROS = ["Centros de Custo", "Contas de Resultado", "Realizado (Consolidado)"];

const texto = (v: ValorCelula | undefined): string | null =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim();

/** Colunas de checagem da planilha: fórmulas de conferência, não cadastro. */
const COLUNAS_DE_CHECAGEM = new Set(["DRE?"]);

function exigirAba(abas: string[], aba: string) {
  if (!abas.includes(aba)) {
    throw new ArquivoInvalidoError(
      `A planilha não tem a aba "${aba}". Envie o SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO. ` +
        `Abas encontradas: ${abas.join(", ")}.`,
    );
  }
  return aba;
}

/** Aba de cadastro: cabeçalho na linha 1, um objeto por linha não vazia. */
export function lerTabela<T>(buffer: Uint8Array, aba: string): T[] {
  const { linhas } = lerAba(buffer, (abas) => exigirAba(abas, aba));
  const cabecalho = linhas[0]?.celulas.map((c) => texto(c)) ?? [];
  const colunas = cabecalho
    .map((h, i) => ({ h, i }))
    .filter(
      (c): c is { h: string; i: number } =>
        c.h !== null && !/^Column\d+$/.test(c.h) && !COLUNAS_DE_CHECAGEM.has(c.h),
    );
  return linhas
    .slice(1)
    .filter((l) => colunas.some((c) => texto(l.celulas[c.i]) !== null))
    .map((l) => Object.fromEntries(colunas.map((c) => [c.h, texto(l.celulas[c.i])])) as T);
}

/** Fórmulas da coluna B de uma aba, por número de linha. */
function formulasDaColunaB(buffer: Uint8Array, aba: string): Map<number, string> {
  const dec = (s: string) =>
    s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const z = unzipSync(buffer, {
    filter: (f) => f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name.startsWith("xl/worksheets/sheet"),
  });
  const wb = dec(strFromU8(z["xl/workbook.xml"]));
  const rels = strFromU8(z["xl/_rels/workbook.xml.rels"]);
  const id = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find((m) => m[1] === aba)?.[2];
  const rel = [...rels.matchAll(/<Relationship [^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`));
  if (!rel) throw new ArquivoInvalidoError(`Aba ${aba} não encontrada`);
  const xml = strFromU8(z[`xl/${rel.match(/Target="([^"]+)"/)![1]}`]);
  const formulas = new Map<number, string>();
  for (const m of xml.matchAll(/<c r="B(\d+)"[^>]*?>(?:<f([^>]*)>([^<]*)<\/f>|<f([^>]*)\/>)/g)) {
    if (m[4] !== undefined) {
      throw new ArquivoInvalidoError(`B${m[1]} da aba ${aba} é fórmula compartilhada, que a leitura não traduz.`);
    }
    if (m[3]) formulas.set(Number(m[1]), dec(m[3]));
  }
  return formulas;
}

function lerEstruturaDRE(buffer: Uint8Array): LinhaBrutaDRE[] {
  const aba = "Realizado (Consolidado)";
  const { linhas } = lerAba(buffer, (abas) => exigirAba(abas, aba));
  const formulas = formulasDaColunaB(buffer, aba);
  const cab = linhas[0].celulas.map((c) => texto(c));
  const col = (nome: string) => {
    const i = cab.indexOf(nome);
    if (i < 0) throw new ArquivoInvalidoError(`Coluna ${nome} não encontrada na aba ${aba}.`);
    return i;
  };
  const [dep, depSigla, atr, atrSigla, obs] = ["DEPARTAMENTO", "DEP.", "ATRIBUIÇÃO", "ATR.", "OBSERVAÇÃO"].map(col);
  return linhas
    .filter((l) => texto(l.celulas[0]) !== null)
    .map((l) => ({
      linhaPlanilha: l.numero,
      descricao: texto(l.celulas[0]),
      formula: formulas.get(l.numero) ?? null,
      grupo: texto(l.celulas[dep]),
      grupoSigla: texto(l.celulas[depSigla]),
      atribuicao: texto(l.celulas[atr]),
      atribuicaoSigla: texto(l.celulas[atrSigla]),
      definicao: texto(l.celulas[obs]),
    }));
}

export function lerPlanilhaCadastros(buffer: Uint8Array): PlanilhaCadastros {
  return {
    centros: lerTabela<LinhaCentroCusto>(buffer, "Centros de Custo"),
    contas: lerTabela<LinhaContaResultado>(buffer, "Contas de Resultado"),
    dre: lerEstruturaDRE(buffer),
  };
}
