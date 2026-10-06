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
type Venda = "global" | "mercantil";
type Imposto = "pisCofinsGlobal" | "pisCofinsMercantil" | "iss" | "icms";
/**
 * Linhas da aba Receitas (Prévia) (leiaute de 06/10/2026, com a venda global e
 * a mercantil separadas): linha, unidade, natureza, campo, rótulo da CONTA DRE
 * nos lançamentos manuais e, nas linhas separadas, a venda.
 */
type Linha = { linha: number; unidade: number; natureza: string; campo: Campo; rotulo: string; venda?: Venda };
const LINHAS: Linha[] = [];
const comVenda = (linha: number, unidade: number, natureza: string, campo: Campo, rotulo: string) =>
  LINHAS.push({ linha, unidade, natureza, campo, rotulo }, { linha: linha + 1, unidade, natureza, campo, rotulo, venda: "global" }, { linha: linha + 2, unidade, natureza, campo, rotulo, venda: "mercantil" });
comVenda(13, 1, "PRE_FABRICADO", "receitaBruta", "Receita Bruta do Pré-Fabricado");
comVenda(16, 1, "FRETE", "receitaBruta", "Receita Bruta de Frete");
comVenda(19, 1, "DEVOLUCOES_INVENTARIOS", "receitaBruta", "Receita Bruta de Devoluções e Inventários");
comVenda(29, 1, "PRE_FABRICADO", "receitaLiquida", "Receita Líquida do Pré-Fabricado");
comVenda(32, 1, "FRETE", "receitaLiquida", "Receita Líquida de Frete");
comVenda(35, 1, "DEVOLUCOES_INVENTARIOS", "receitaLiquida", "Receita Líquida de Devoluções e Inventários");
comVenda(50, 2, "PRE_FABRICADO", "receitaBruta", "Receita Bruta do Pré-Fabricado");
comVenda(53, 2, "FRETE", "receitaBruta", "Receita Bruta de Frete");
comVenda(56, 2, "DEVOLUCOES_INVENTARIOS", "receitaBruta", "Receita Bruta de Devoluções e Inventários");
comVenda(66, 2, "PRE_FABRICADO", "receitaLiquida", "Receita Líquida do Pré-Fabricado");
comVenda(69, 2, "FRETE", "receitaLiquida", "Receita Líquida de Frete");
comVenda(72, 2, "DEVOLUCOES_INVENTARIOS", "receitaLiquida", "Receita Líquida de Devoluções e Inventários");
LINHAS.push(
  { linha: 76, unidade: 2, natureza: "PRE_FABRICADO", campo: "variacaoEstoque", rotulo: "Variação do Estoque" },
  { linha: 84, unidade: 3, natureza: "MONTAGEM", campo: "receitaBruta", rotulo: "Receita Bruta de Montagem" },
  { linha: 85, unidade: 3, natureza: "COMPLEMENTAR", campo: "receitaBruta", rotulo: "Receita Bruta Complementar" },
  { linha: 91, unidade: 3, natureza: "MONTAGEM", campo: "receitaLiquida", rotulo: "Receita Líquida de Montagem" },
  { linha: 92, unidade: 3, natureza: "COMPLEMENTAR", campo: "receitaLiquida", rotulo: "Receita Líquida Complementar" },
);
/** Os impostos abertos: linha, unidade, imposto. */
const IMPOSTOS: Array<[number, number, Imposto, string]> = [
  [24, 1, "pisCofinsGlobal", "Impostos (PIS/COFINS Global)"],
  [25, 1, "pisCofinsMercantil", "Impostos (PIS/COFINS Mercantil)"],
  [26, 1, "iss", "Impostos (ISS)"],
  [27, 1, "icms", "Impostos (ICMS)"],
  [61, 2, "pisCofinsGlobal", "Impostos (PIS/COFINS Global)"],
  [62, 2, "pisCofinsMercantil", "Impostos (PIS/COFINS Mercantil)"],
  [63, 2, "iss", "Impostos (ISS)"],
  [64, 2, "icms", "Impostos (ICMS)"],
  [88, 3, "pisCofinsGlobal", "Impostos (PIS/COFINS)"],
  [89, 3, "iss", "Impostos (ISS)"],
];
const NOME_UNIDADE = { 1: "MATRIZ", 2: "FILIAL", 3: "OBRAS" } as Record<number, string>;

const mesDoSerial = (v: unknown) => {
  if (typeof v !== "number") return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
  return d.getUTCFullYear() === ano ? d.getUTCMonth() + 1 : null;
};
/** Soma dos lançamentos manuais da planilha para a linha, como o SOMASES da própria aba (VENDA na coluna F, valor na G). */
function manual(mes: number, unidade: number, rotulo: string, venda?: Venda) {
  return manuais
    .filter(
      (l) =>
        mesDoSerial(l.celulas[0]) === mes &&
        String(l.celulas[4] ?? "").trim() === rotulo &&
        (unidade === 3 || Number(l.celulas[1]) === unidade) &&
        (!venda || String(l.celulas[5] ?? "").trim().toUpperCase() === (venda === "global" ? "G" : "M")),
    )
    .reduce((a, l) => a + (Number(l.celulas[6]) || 0), 0);
}

let totalDiferencas = 0;
for (let mes = Number(de); mes <= Number(ate); mes++) {
  const { avisos } = await apuracaoService.apurar(ano, mes, USUARIO);
  const r = { ...(await receitaPreviaService.consultar(ano, mes)), avisos };
  const col = 1 + (mes - 1) * 2;
  console.log(`\nCompetência ${String(mes).padStart(2, "0")}/${ano}${semManuais ? " (planilha sem os lançamentos manuais)" : ""}`);
  for (const a of r.avisos) console.log(`  aviso: ${a}`);
  const comparar = (linha: number, rotulo: string, sistema: number, descontar: number) => {
    const bruto = Number(previa.get(linha)?.[col] ?? 0) || 0;
    const planilha = semManuais ? bruto - descontar : bruto;
    const dif = sistema - planilha;
    const ok = Math.abs(dif) <= 0.05;
    if (!ok) totalDiferencas++;
    console.log(
      `  ${ok ? "  " : "≠ "}L${String(linha).padEnd(3)} ${rotulo.padEnd(64)} sistema ${sistema.toFixed(2).padStart(15)} | planilha ${planilha.toFixed(2).padStart(15)}${ok ? "" : ` | dif ${dif.toFixed(2)}`}`,
    );
  };
  for (const { linha, unidade, natureza, campo, rotulo, venda } of LINHAS) {
    const sistema = venda
      ? Number(r.porVenda.find((x) => x.unidade === unidade && x.natureza === natureza)?.[venda][campo as "receitaBruta" | "receitaLiquida"] ?? 0)
      : Number(r.receitas.find((x) => x.unidade === unidade && x.natureza === natureza)?.[campo] ?? 0);
    comparar(linha, `${NOME_UNIDADE[unidade]} ${rotulo}${venda ? ` (${venda})` : ""}`, sistema, manual(mes, unidade, rotulo, venda));
  }
  for (const [linha, unidade, imposto, rotulo] of IMPOSTOS) {
    comparar(linha, `${NOME_UNIDADE[unidade]} ${rotulo}`, Number(r.impostos.find((x) => x.unidade === unidade)?.[imposto] ?? 0), 0);
  }
}
console.log(totalDiferencas === 0 ? "\nTudo confere." : `\n${totalDiferencas} linha(s) com diferença.`);
