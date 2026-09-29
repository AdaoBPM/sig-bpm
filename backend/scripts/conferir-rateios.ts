/**
 * Conferência dos percentuais de rateio (Passo 15) contra a planilha.
 *
 * Apura os rateios das competências pedidas e compara, pelo rótulo da linha,
 * com a aba Rateios do SIG BPM 2026 - BASE REALIZADO (OPERAÇÃO).
 *
 * Uso: npx tsx scripts/conferir-rateios.ts "<BASE REALIZADO (OPERAÇÃO).xlsx>" 2026 1 8
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { lerAba } from "../src/lib/xlsx.js";
import { rateiosService } from "../src/services/volumes/rateiosService.js";

const [arquivo, anoTexto, de, ate = de] = process.argv.slice(2);
if (!arquivo || !anoTexto || !de) {
  console.error('Uso: npx tsx scripts/conferir-rateios.ts "<BASE REALIZADO (OPERAÇÃO).xlsx>" 2026 1 8');
  process.exit(1);
}
const ano = Number(anoTexto);
const aba = lerAba(readFileSync(arquivo), (abas) => (abas.includes("Rateios") ? "Rateios" : null));
const cabecalho = aba.linhas[0].celulas;
const colunaDoMes = (mes: number) =>
  cabecalho.findIndex((v) => {
    if (typeof v !== "number") return false;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes;
  });

let diferencas = 0;
for (let mes = Number(de); mes <= Number(ate); mes++) {
  const col = colunaDoMes(mes);
  if (col < 0) throw new Error(`A aba Rateios não tem a coluna de ${mes}/${ano}`);
  const planilha = new Map(aba.linhas.slice(1).map((l) => [String(l.celulas[0] ?? "").trim(), Number(l.celulas[col] ?? 0)]));
  const r = await rateiosService.apurar(ano, mes);
  console.log(`\nCompetência ${String(mes).padStart(2, "0")}/${ano}`);
  for (const k of r.chaves) {
    for (const d of k.destinos as Array<{ rotulo: string; quantidade: string; percentual: string }>) {
      const esperado = planilha.get(d.rotulo);
      const obtido = Number(d.percentual);
      const ok = esperado !== undefined && Math.abs(esperado - obtido) <= 1e-9;
      if (!ok) diferencas++;
      console.log(
        `  ${ok ? "  " : "≠ "}${d.rotulo.padEnd(34)} volume ${Number(d.quantidade).toFixed(3).padStart(12)} | sistema ${(obtido * 100).toFixed(4).padStart(8)}% | planilha ${esperado === undefined ? "(ausente)" : `${(esperado * 100).toFixed(4).padStart(8)}%`}`,
      );
    }
  }
}
console.log(diferencas === 0 ? "\nTudo confere." : `\n${diferencas} percentual(is) com diferença.`);
