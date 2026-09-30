/**
 * Conferência do detalhamento da DRE (Passo 20).
 *
 * Apura as competências pedidas e, para cada valor da DRE — por unidade,
 * consolidada e por agrupamento de centros —, abre o detalhamento e confere
 * que a soma das parcelas de origem é o valor da linha. Lista à parte as
 * linhas com valor e sem origem própria (as derivadas, como as receitas
 * líquidas do pré-fabricado).
 *
 * Uso: npx tsx scripts/conferir-detalhamento.ts 2026 1 8
 */
import "dotenv/config";

import { getPrismaClient } from "../src/config/prisma.js";
import { apuracaoService } from "../src/services/apuracao/apuracaoService.js";
import { detalhamentoService, type Visao } from "../src/services/dre/detalhamentoService.js";
import { dreService } from "../src/services/dre/dreService.js";

const USUARIO = "00000000-0000-0000-0000-000000000001"; // administrador da carga
const [anoTexto, de, ate = de] = process.argv.slice(2);
if (!anoTexto || !de) {
  console.error("Uso: npx tsx scripts/conferir-detalhamento.ts 2026 1 8");
  process.exit(1);
}
const ano = Number(anoTexto);
const prisma = getPrismaClient();
let falhas = 0;

for (let mes = Number(de); mes <= Number(ate); mes++) {
  await apuracaoService.apurar(ano, mes, USUARIO);
  const visoes: Array<[string, Visao, Awaited<ReturnType<typeof dreService.consultarUnidade>>["linhas"]]> = [];
  for (const u of [1, 2, 3, 4, 5]) visoes.push([`unidade ${u}`, { unidade: u }, (await dreService.consultarUnidade(ano, mes, u)).linhas]);
  visoes.push(["consolidado", { consolidado: true }, (await dreService.consultarConsolidado(ano, mes)).linhas]);
  for (const g of (await dreService.listarCentros(ano, mes)).grupos) {
    visoes.push([`centro ${g.grupo}`, { grupo: g.grupo }, (await dreService.consultarCentros(ano, mes, g.grupo)).linhas]);
  }
  let abertos = 0;
  let fecham = 0;
  const derivadas = new Map<string, number>();
  for (const [nome, visao, linhas] of visoes) {
    for (const l of linhas) {
      if (l.valor === null || l.tipo === "SECAO" || l.grupoSigla === "P" || l.grupoSigla === "S") continue;
      if (l.tipo !== "ITEM" && !(l.descricao === "Impostos Operacionais" && nome.startsWith("unidade"))) continue;
      const d = await detalhamentoService.detalhar(ano, mes, l.codigo, visao);
      abertos++;
      if (d.somaOrigens === null) {
        if (Number(l.valor) !== 0) derivadas.set(`${nome.startsWith("centro") ? "centro" : nome} · ${l.descricao}`, (derivadas.get(`${nome} · ${l.descricao}`) ?? 0) + 1);
        continue;
      }
      if (Math.abs(Number(d.somaOrigens) - Number(l.valor)) > 0.05) {
        falhas++;
        console.log(`  ≠ ${String(mes).padStart(2, "0")}/${ano} ${nome} · ${l.descricao}: valor ${l.valor} | soma das origens ${d.somaOrigens}`);
      } else fecham++;
    }
  }
  console.log(`${String(mes).padStart(2, "0")}/${ano}: ${abertos} valores abertos, ${fecham} fecham com as origens; derivados sem origem própria: ${[...derivadas.keys()].join("; ") || "nenhum"}`);
}
console.log(falhas === 0 ? "\nTodo detalhamento fecha com o valor da linha." : `\n${falhas} detalhamento(s) não fecham.`);
await prisma.$disconnect();
