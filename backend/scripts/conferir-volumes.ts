/**
 * Conferência dos volumes de rateio contra a planilha, para o período de paralelo.
 *
 * Compara, linha a linha, os volumes calculados das listas gravadas na
 * competência com a aba Totais do SIG BPM 2026 - BASE REALIZADO (OPERAÇÃO).
 *
 * Uso: npx tsx scripts/conferir-volumes.ts "<BASE REALIZADO (OPERAÇÃO).xlsx>" 2026 1
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba } from "../src/lib/xlsx.js";
import { totaisDaCompetencia } from "../src/services/volumes/volumesService.js";

const [arquivo, anoTexto, mesTexto] = process.argv.slice(2);
if (!arquivo || !anoTexto || !mesTexto) {
  console.error("Uso: npx tsx scripts/conferir-volumes.ts <OPERAÇÃO.xlsx> <ano> <mes>");
  process.exit(1);
}
const ano = Number(anoTexto);
const mes = Number(mesTexto);

const aba = lerAba(readFileSync(arquivo), (abas) => (abas.includes("Totais") ? "Totais" : null));
const cabecalho = aba.linhas[0].celulas;
const colMes = cabecalho.findIndex((v) => {
  if (typeof v !== "number") return false;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
  return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes;
});
if (colMes < 0) throw new Error(`A aba Totais não tem a coluna de ${mes}/${ano}`);
const planilha = new Map(aba.linhas.slice(1).map((l) => [String(l.celulas[0] ?? "").trim(), Number(l.celulas[colMes] ?? 0)]));

const competencia = await getPrismaClient().competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } } });
const totais = await totaisDaCompetencia(competencia.id);

let diferencas = 0;
console.log(`Competência ${String(mes).padStart(2, "0")}/${ano}`);
for (const t of totais) {
  const esperado = planilha.get(t.rotulo);
  const obtido = Number(t.quantidade);
  const ok = esperado !== undefined && Math.abs(esperado - obtido) <= 0.001;
  if (!ok) diferencas++;
  console.log(
    `  ${ok ? "  " : "≠ "}${t.rotulo.padEnd(36)} sistema ${obtido.toFixed(3).padStart(12)} ${t.medida.padEnd(3)} | planilha ${esperado === undefined ? "(linha ausente)" : esperado.toFixed(3).padStart(12)}`,
  );
}
console.log(diferencas === 0 ? "Tudo confere." : `${diferencas} linha(s) com diferença.`);
