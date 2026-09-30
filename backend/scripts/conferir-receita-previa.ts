/**
 * Conferência da receita prévia (Passo 16) contra a planilha.
 *
 * Apura a receita das competências pedidas e compara, linha a linha, com a aba
 * `Receitas (Prévia)` do SIG BPM 2026 - BASE PRÉVIAS (RECEITAS E ESTOQUE).
 *
 * Os lançamentos manuais de receita são digitados na ferramenta; enquanto não
 * forem, a conferência desconta da planilha os da aba `Receita (Lanç. Manuais)`
 * do mesmo arquivo (com --sem-manuais), para comparar só o que vem das listas.
 *
 * Uso: npx tsx scripts/conferir-receita-previa.ts "<BASE PRÉVIAS.xlsx>" 2026 1 8 [--sem-manuais]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { lerAba } from "../src/lib/xlsx.js";
import { apuracaoService } from "../src/services/apuracao/apuracaoService.js";
import { receitaPreviaService } from "../src/services/receitaPrevia/receitaPreviaService.js";

const USUARIO = "00000000-0000-0000-0000-000000000001"; // administrador da carga
const args = process.argv.slice(2);
const semManuais = args.includes("--sem-manuais");
const [arquivo, anoTexto, de, ate = de] = args.filter((a) => !a.startsWith("--"));
if (!arquivo || !anoTexto || !de) {
  console.error('Uso: npx tsx scripts/conferir-receita-previa.ts "<BASE PRÉVIAS.xlsx>" 2026 1 8 [--sem-manuais]');
  process.exit(1);
}
const ano = Number(anoTexto);
const buf = readFileSync(arquivo);
const aba = (nome: string) => lerAba(buf, (abas) => abas.find((a) => a.normalize("NFC") === nome.normalize("NFC")) ?? null).linhas;
const previa = new Map(aba("Receitas (Prévia)").map((l) => [l.numero, l.celulas]));
const manuais = aba("Receita (Lanç. Manuais)").slice(1);

type Campo = "receitaBruta" | "receitaLiquida" | "variacaoEstoque";
/** Linhas da aba Receitas (Prévia): unidade, natureza, campo, rótulo da CONTA DRE nos lançamentos manuais. */
const LINHAS: Array<[number, number, string, Campo, string]> = [
  [9, 1, "PRE_FABRICADO", "receitaBruta", "Receita Bruta do Pré-Fabricado"],
  [10, 1, "FRETE", "receitaBruta", "Receita Bruta de Frete"],
  [11, 1, "DEVOLUCOES_INVENTARIOS", "receitaBruta", "Receita Bruta de Devoluções e Inventários"],
  [15, 1, "PRE_FABRICADO", "receitaLiquida", "Receita Líquida do Pré-Fabricado"],
  [16, 1, "FRETE", "receitaLiquida", "Receita Líquida de Frete"],
  [17, 1, "DEVOLUCOES_INVENTARIOS", "receitaLiquida", "Receita Líquida de Devoluções e Inventários"],
  [26, 2, "PRE_FABRICADO", "receitaBruta", "Receita Bruta do Pré-Fabricado"],
  [27, 2, "FRETE", "receitaBruta", "Receita Bruta de Frete"],
  [28, 2, "DEVOLUCOES_INVENTARIOS", "receitaBruta", "Receita Bruta de Devoluções e Inventários"],
  [32, 2, "PRE_FABRICADO", "receitaLiquida", "Receita Líquida do Pré-Fabricado"],
  [33, 2, "FRETE", "receitaLiquida", "Receita Líquida de Frete"],
  [34, 2, "DEVOLUCOES_INVENTARIOS", "receitaLiquida", "Receita Líquida de Devoluções e Inventários"],
  [36, 2, "PRE_FABRICADO", "variacaoEstoque", "Variação do Estoque"],
  [44, 3, "MONTAGEM", "receitaBruta", "Receita Bruta de Montagem"],
  [45, 3, "COMPLEMENTAR", "receitaBruta", "Receita Bruta Complementar"],
  [49, 3, "MONTAGEM", "receitaLiquida", "Receita Líquida de Montagem"],
  [50, 3, "COMPLEMENTAR", "receitaLiquida", "Receita Líquida Complementar"],
];
const NOME_UNIDADE = { 1: "MATRIZ", 2: "FILIAL", 3: "OBRAS" } as Record<number, string>;

const mesDoSerial = (v: unknown) => {
  if (typeof v !== "number") return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
  return d.getUTCFullYear() === ano ? d.getUTCMonth() + 1 : null;
};
/** Soma dos lançamentos manuais da planilha para a linha, como o SOMASES da própria aba. */
function manual(mes: number, unidade: number, rotulo: string) {
  return manuais
    .filter((l) => mesDoSerial(l.celulas[0]) === mes && String(l.celulas[4] ?? "").trim() === rotulo && (unidade === 3 || Number(l.celulas[1]) === unidade))
    .reduce((a, l) => a + (Number(l.celulas[5]) || 0), 0);
}

let totalDiferencas = 0;
for (let mes = Number(de); mes <= Number(ate); mes++) {
  const { avisos } = await apuracaoService.apurar(ano, mes, USUARIO);
  const r = { ...(await receitaPreviaService.consultar(ano, mes)), avisos };
  const col = 1 + (mes - 1) * 2;
  console.log(`\nCompetência ${String(mes).padStart(2, "0")}/${ano}${semManuais ? " (planilha sem os lançamentos manuais)" : ""}`);
  for (const a of r.avisos) console.log(`  aviso: ${a}`);
  for (const [linha, unidade, natureza, campo, rotulo] of LINHAS) {
    const sistema = Number(r.receitas.find((x) => x.unidade === unidade && x.natureza === natureza)?.[campo] ?? 0);
    const bruto = Number(previa.get(linha)?.[col] ?? 0) || 0;
    const planilha = semManuais ? bruto - manual(mes, unidade, rotulo) : bruto;
    const dif = sistema - planilha;
    const ok = Math.abs(dif) <= 0.05;
    if (!ok) totalDiferencas++;
    console.log(
      `  ${ok ? "  " : "≠ "}${NOME_UNIDADE[unidade].padEnd(7)} ${rotulo.padEnd(44)} sistema ${sistema.toFixed(2).padStart(15)} | planilha ${planilha.toFixed(2).padStart(15)}${ok ? "" : ` | dif ${dif.toFixed(2)}`}`,
    );
  }
}
console.log(totalDiferencas === 0 ? "\nTudo confere." : `\n${totalDiferencas} linha(s) com diferença.`);
