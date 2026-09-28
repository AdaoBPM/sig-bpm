/**
 * Exporta os cadastros do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO para os
 * JSON da carga inicial (prisma/carga-inicial/).
 *
 *  - Centros de Custo       → centros-custo.json
 *  - Contas de Resultado    → contas-resultado.json
 *  - Realizado (Consolidado) → dre-estrutura.json (rótulo, fórmula da coluna
 *    de janeiro e as colunas de departamento, atribuição e observação)
 *
 * A exportação é fiel: uma chave por coluna, valores como texto, sem correção.
 * Correções acordadas ficam em ajustes-carga.ts e nos carregadores. Rodar de
 * novo sempre que a planilha mudar, e conferir o diff dos JSON antes de carregar.
 *
 * Uso: npx tsx prisma/exportar-cadastros.ts "<UNIDADES E CENTROS DE CUSTO.xlsx>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { strFromU8, unzipSync } from "fflate";

import { lerAba, type ValorCelula } from "../src/lib/xlsx.js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Informe o caminho do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO.xlsx");
  process.exit(1);
}
const buffer = readFileSync(arquivo);
const destino = join(dirname(fileURLToPath(import.meta.url)), "carga-inicial");

const texto = (v: ValorCelula | undefined): string | null =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim();

/** Colunas de checagem da planilha: fórmulas de conferência, não cadastro. */
const COLUNAS_DE_CHECAGEM = new Set(["DRE?"]);

function gravar(nome: string, dados: unknown[]) {
  writeFileSync(join(destino, nome), `${JSON.stringify(dados, null, 2)}\n`);
  console.log(`${nome}: ${dados.length} registros`);
}

/** Aba de cadastro: cabeçalho na linha 1, um objeto por linha não vazia. */
function exportarTabela(aba: string, nome: string) {
  const { linhas } = lerAba(buffer, (abas) => (abas.includes(aba) ? aba : null));
  const cabecalho = linhas[0].celulas.map((c) => texto(c));
  const colunas = cabecalho
    .map((h, i) => ({ h, i }))
    .filter(
      (c): c is { h: string; i: number } =>
        c.h !== null && !/^Column\d+$/.test(c.h) && !COLUNAS_DE_CHECAGEM.has(c.h),
    );
  const registros = linhas
    .slice(1)
    .filter((l) => colunas.some((c) => texto(l.celulas[c.i]) !== null))
    .map((l) => Object.fromEntries(colunas.map((c) => [c.h, texto(l.celulas[c.i])])));
  gravar(nome, registros);
}

/** Fórmulas da coluna B de uma aba, por número de linha. */
function formulasDaColunaB(aba: string): Map<number, string> {
  const dec = (s: string) =>
    s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const z = unzipSync(buffer, {
    filter: (f) => f.name === "xl/workbook.xml" || f.name === "xl/_rels/workbook.xml.rels" || f.name.startsWith("xl/worksheets/sheet"),
  });
  const wb = dec(strFromU8(z["xl/workbook.xml"]));
  const rels = strFromU8(z["xl/_rels/workbook.xml.rels"]);
  const id = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].find((m) => m[1] === aba)?.[2];
  const rel = [...rels.matchAll(/<Relationship [^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${id}"`));
  if (!rel) throw new Error(`Aba ${aba} não encontrada`);
  const xml = strFromU8(z[`xl/${rel.match(/Target="([^"]+)"/)![1]}`]);
  const formulas = new Map<number, string>();
  for (const m of xml.matchAll(/<c r="B(\d+)"[^>]*?>(?:<f([^>]*)>([^<]*)<\/f>|<f([^>]*)\/>)/g)) {
    if (m[4] !== undefined) {
      throw new Error(`B${m[1]} de ${aba} é fórmula compartilhada: a exportação não a traduz`);
    }
    if (m[3]) formulas.set(Number(m[1]), dec(m[3]));
  }
  return formulas;
}

function exportarEstruturaDRE() {
  const aba = "Realizado (Consolidado)";
  const { linhas } = lerAba(buffer, (abas) => (abas.includes(aba) ? aba : null));
  const formulas = formulasDaColunaB(aba);
  const cab = linhas[0].celulas.map((c) => texto(c));
  const col = (nome: string) => {
    const i = cab.indexOf(nome);
    if (i < 0) throw new Error(`Coluna ${nome} não encontrada em ${aba}`);
    return i;
  };
  const [dep, depSigla, atr, atrSigla, obs] = ["DEPARTAMENTO", "DEP.", "ATRIBUIÇÃO", "ATR.", "OBSERVAÇÃO"].map(col);
  gravar(
    "dre-estrutura.json",
    linhas
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
      })),
  );
}

exportarTabela("Centros de Custo", "centros-custo.json");
exportarTabela("Contas de Resultado", "contas-resultado.json");
exportarEstruturaDRE();
