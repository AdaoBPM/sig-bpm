/**
 * Conferência da DRE por unidade (Passo 18) contra a planilha.
 *
 * Apura a DRE das competências pedidas e compara, linha a linha, com as abas
 * Resultados (Matriz), (Filial), (Serviços), (Desp.+Extra) e (RN) do
 * SIG BPM 2026 - BASE REALIZADO (RESULTADOS). As linhas das abas são ligadas
 * às da estrutura da DRE pela descrição, na ordem (cada aba é um trecho da
 * estrutura do Consolidado).
 *
 * Uso: npx tsx scripts/conferir-dre-unidades.ts "<BASE REALIZADO (RESULTADOS).xlsx>" 2026 1 8 [unidade]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba } from "../src/lib/xlsx.js";
import { dreService } from "../src/services/dre/dreService.js";

const [arquivo, anoTexto, de, ate = de, soUnidade] = process.argv.slice(2);
if (!arquivo || !anoTexto || !de) {
  console.error('Uso: npx tsx scripts/conferir-dre-unidades.ts "<BASE REALIZADO (RESULTADOS).xlsx>" 2026 1 8 [unidade]');
  process.exit(1);
}
const ano = Number(anoTexto);
const buf = readFileSync(arquivo);
const ABAS: Record<number, string> = { 1: "Resultados (Matriz)", 2: "Resultados (Filial)", 3: "Resultados (Serviços)", 4: "Resultados (Desp.+Extra)", 5: "Resultados (RN)" };
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const n = (s: unknown) => String(s ?? "").trim().toUpperCase();

const prisma = getPrismaClient();
const estrutura = await prisma.linhaDRE.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, codigo: true, descricao: true } });

/** Liga cada linha da aba a uma linha da estrutura: a próxima, na ordem, com a mesma descrição. */
function ligar(linhas: ReturnType<typeof lerAba>["linhas"]) {
  const mapa = new Map<number, (typeof estrutura)[number]>();
  let j = 0;
  for (const l of linhas.slice(1)) {
    const desc = n(l.celulas[0]);
    if (!desc) continue;
    const k = estrutura.findIndex((e, i) => i >= j && n(e.descricao) === desc);
    if (k < 0) continue;
    mapa.set(l.numero, estrutura[k]);
    j = k + 1;
  }
  return mapa;
}

let totalDif = 0;
for (let mes = Number(de); mes <= Number(ate); mes++) {
  const r = await dreService.apurarUnidades(ano, mes);
  console.log(`\nCompetência ${String(mes).padStart(2, "0")}/${ano}: ${r.resultados} valores apurados`);
  for (const a of r.avisos) console.log(`  aviso: ${a}`);
  for (const u of [1, 2, 3, 4, 5]) {
    if (soUnidade && Number(soUnidade) !== u) continue;
    const aba = lerAba(buf, (abas) => abas.find((x) => x.normalize("NFC") === ABAS[u].normalize("NFC")) ?? null);
    const col = aba.linhas[0].celulas.findIndex((v) => n(v) === `${MESES[mes - 1]}/${String(ano).slice(2)}`);
    const mapa = ligar(aba.linhas);
    const dre = await dreService.consultarUnidade(ano, mes, u);
    const valor = new Map(dre.linhas.map((l) => [l.codigo, l.valor]));
    let dif = 0;
    let comparadas = 0;
    for (const l of aba.linhas.slice(1)) {
      const e = mapa.get(l.numero);
      if (!e) continue;
      if ((u === 4 || u === 5) && n(e.descricao) === n("RECEITA OPERACIONAL LÍQUIDA (ROL)")) continue; // é a ROL consolidada
      const planilha = Number(l.celulas[col] ?? 0) || 0;
      const sistema = Number(valor.get(e.codigo) ?? 0);
      comparadas++;
      if (Math.abs(planilha - sistema) > 0.05) {
        dif++;
        if (dif <= 12) console.log(`  ≠ ${ABAS[u]} linha ${l.numero} ${String(l.celulas[0]).slice(0, 45).padEnd(45)} sistema ${sistema.toFixed(2).padStart(15)} | planilha ${planilha.toFixed(2).padStart(15)} | dif ${(sistema - planilha).toFixed(2)}`);
      }
    }
    totalDif += dif;
    console.log(`  ${dif === 0 ? "✓" : "✗"} ${ABAS[u]}: ${comparadas} linhas, ${dif} diferença(s)`);
  }
}
console.log(totalDif === 0 ? "\nTudo confere." : `\n${totalDif} diferença(s).`);
await prisma.$disconnect();
