/**
 * Conferência da DRE consolidada e da visão por centro de custo (Passo 19)
 * contra o SIG BPM 2026 - BASE REALIZADO (RESULTADOS).
 *
 * - Consolidado: apura as competências pedidas e compara, linha a linha, com a
 *   aba Resultados (Consolidado) — a mesma fórmula da Realizado (Consolidado)
 *   do UNIDADES E CENTROS DE CUSTO. As linhas são ligadas às da estrutura pela
 *   descrição, na ordem.
 * - Centros de custo: a aba Realizado (Centro de Custo) do UNIDADES E CENTROS
 *   DE CUSTO mostra um agrupamento por vez, com SOMASES da Gastos (Contábil)
 *   por C. CUSTO (AGRUPADO), DRE (DEPARTAMENTO), DRE (ATRIBUIÇÃO) e DRE (CONTA
 *   DE RESULTADO). A conferência faz essas somas para todos os agrupamentos e
 *   linhas, na Gastos (Contábil) do RESULTADOS, e compara com a ferramenta.
 *
 * Uso: npx tsx scripts/conferir-dre-consolidado.ts "<BASE REALIZADO (RESULTADOS).xlsx>" 2026 1 8
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba } from "../src/lib/xlsx.js";
import { dreService } from "../src/services/dre/dreService.js";

const [arquivo, anoTexto, de, ate = de] = process.argv.slice(2);
if (!arquivo || !anoTexto || !de) {
  console.error('Uso: npx tsx scripts/conferir-dre-consolidado.ts "<BASE REALIZADO (RESULTADOS).xlsx>" 2026 1 8');
  process.exit(1);
}
const ano = Number(anoTexto);
const buf = readFileSync(arquivo);
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const n = (s: unknown) => String(s ?? "").trim().toUpperCase();
const aba = (nome: string) => lerAba(buf, (abas) => abas.find((x) => x.normalize("NFC") === nome.normalize("NFC")) ?? null);

const prisma = getPrismaClient();
const estrutura = await prisma.linhaDRE.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, codigo: true, descricao: true } });
const consolidado = aba("Resultados (Consolidado)");
const gastos = aba("Gastos (Contábil)");

/** Liga cada linha da aba a uma linha da estrutura: a próxima, na ordem, com a mesma descrição. */
const ligacao = new Map<number, (typeof estrutura)[number]>();
{
  let j = 0;
  for (const l of consolidado.linhas.slice(1)) {
    const desc = n(l.celulas[0]);
    const k = desc ? estrutura.findIndex((e, i) => i >= j && n(e.descricao) === desc) : -1;
    if (k < 0) continue;
    ligacao.set(l.numero, estrutura[k]);
    j = k + 1;
  }
}

let totalDif = 0;
for (let mes = Number(de); mes <= Number(ate); mes++) {
  const r = await dreService.apurar(ano, mes);
  console.log(`\nCompetência ${String(mes).padStart(2, "0")}/${ano}: ${r.consolidado} linhas consolidadas, ${r.centros} valores por centro`);

  // --- Consolidado --------------------------------------------------------
  const col = consolidado.linhas[0].celulas.findIndex((v) => n(v) === `${MESES[mes - 1]}/${String(ano).slice(2)}`);
  const dre = await dreService.consultarConsolidado(ano, mes);
  const valor = new Map(dre.linhas.map((l) => [l.codigo, l.valor]));
  let dif = 0;
  let comparadas = 0;
  for (const l of consolidado.linhas.slice(1)) {
    const e = ligacao.get(l.numero);
    if (!e) continue;
    const planilha = Number(l.celulas[col] ?? 0) || 0;
    const sistema = Number(valor.get(e.codigo) ?? 0);
    comparadas++;
    if (Math.abs(planilha - sistema) > 0.05) {
      dif++;
      if (dif <= 15) console.log(`  ≠ Resultados (Consolidado) linha ${l.numero} ${String(l.celulas[0]).slice(0, 45).padEnd(45)} sistema ${sistema.toFixed(2).padStart(15)} | planilha ${planilha.toFixed(2).padStart(15)} | dif ${(sistema - planilha).toFixed(2)}`);
    }
  }
  totalDif += dif;
  console.log(`  ${dif === 0 ? "✓" : "✗"} Resultados (Consolidado): ${comparadas} linhas, ${dif} diferença(s)`);

  // --- Centros de custo ---------------------------------------------------
  const cab = gastos.linhas[0].celulas;
  const colMes = cab.findIndex((v) => String(v ?? "").startsWith(`01/${String(mes).padStart(2, "0")}/${ano}`));
  const [Q, R, S, T] = ["C. CUSTO (AGRUPADO)", "DRE (DEPARTAMENTO)", "DRE (ATRIBUIÇÃO)", "DRE (CONTA DE RESULTADO)"].map((h) => cab.findIndex((v) => n(v) === n(h)));
  const planilha = new Map<string, number>();
  for (const l of gastos.linhas.slice(1)) {
    const g = n(l.celulas[Q]);
    if (!g || g === "-" || g === "0" || n(l.celulas[R]) === "-") continue;
    const k = `${g}|${n(l.celulas[R])}|${n(l.celulas[S])}|${n(l.celulas[T])}`;
    planilha.set(k, (planilha.get(k) ?? 0) + (Number(l.celulas[colMes] ?? 0) || 0));
  }
  const c = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } }, select: { id: true } });
  const gravados = await prisma.resultadoApurado.findMany({
    where: { competenciaId: c.id, centroCustoId: { not: null } },
    select: {
      valor: true,
      composicao: true,
      centroCusto: { select: { nomeRM: true, nomeControladoria: true } },
      linhaDRE: { select: { grupo: true, atribuicao: true, descricao: true } },
    },
  });
  const sistema = new Map<string, number>();
  for (const g of gravados) {
    if (!(g.composicao as { direto?: string } | null)?.direto) continue; // só as linhas com lançamento; os agregadores são somas delas
    const grupo = n(g.centroCusto!.nomeControladoria || g.centroCusto!.nomeRM);
    const k = `${grupo}|${n(g.linhaDRE.grupo)}|${n(g.linhaDRE.atribuicao)}|${n(g.linhaDRE.descricao)}`;
    sistema.set(k, (sistema.get(k) ?? 0) + Number(g.valor));
  }
  let difC = 0;
  const chaves = new Set([...planilha.keys(), ...sistema.keys()]);
  for (const k of [...chaves].sort()) {
    const p = planilha.get(k) ?? 0;
    const s = sistema.get(k) ?? 0;
    if (Math.abs(p - s) <= 0.05) continue;
    difC++;
    if (difC <= 15) console.log(`  ≠ ${k.padEnd(110)} sistema ${s.toFixed(2).padStart(13)} | planilha ${p.toFixed(2).padStart(13)} | dif ${(s - p).toFixed(2)}`);
  }
  totalDif += difC;
  const grupos = new Set([...chaves].map((k) => k.split("|")[0]));
  console.log(`  ${difC === 0 ? "✓" : "✗"} Centros de custo (Gastos (Contábil)): ${grupos.size} agrupamentos, ${chaves.size} linhas, ${difC} diferença(s)`);
}
console.log(totalDif === 0 ? "\nTudo confere." : `\n${totalDif} diferença(s).`);
await prisma.$disconnect();
