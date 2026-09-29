/**
 * Carga, para o período de paralelo, dos lançamentos manuais (a RN) da aba
 * `Gastos (Lanç. Manuais)` do SIG BPM 2026 - BASE REALIZADO (RESULTADOS), como
 * se tivessem sido digitados na ferramenta. Serve para conferir a DRE contra a
 * planilha; na operação, os lançamentos são digitados na tela.
 *
 * Substitui os lançamentos manuais dos meses pedidos. Valores zero não entram.
 *
 * Uso: npx tsx scripts/carregar-lancamentos-manuais.ts "<BASE REALIZADO (RESULTADOS).xlsx>" 2026 3 8
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba } from "../src/lib/xlsx.js";
import { lancamentosManuaisService } from "../src/services/lancamentosManuais/lancamentosManuaisService.js";

const [arquivo, anoTexto, de, ate = de] = process.argv.slice(2);
if (!arquivo || !anoTexto || !de) {
  console.error('Uso: npx tsx scripts/carregar-lancamentos-manuais.ts "<BASE REALIZADO (RESULTADOS).xlsx>" 2026 3 8');
  process.exit(1);
}
const ano = Number(anoTexto);
const USUARIO = "00000000-0000-0000-0000-000000000001";
const aba = lerAba(readFileSync(arquivo), (abas) => abas.find((a) => a.normalize("NFC") === "Gastos (Lanç. Manuais)".normalize("NFC")) ?? null);
const cab = aba.linhas[0].celulas;
const serialDoMes = (mes: number) => Math.round((Date.UTC(ano, mes - 1, 1) - Date.UTC(1899, 11, 30)) / 86_400_000);
const prisma = getPrismaClient();
const contas = new Map((await prisma.contaResultado.findMany({ select: { id: true, reduzido: true, descricao: true } })).map((c) => [c.reduzido, c]));
const centros = new Map((await prisma.centroCusto.findMany({ select: { id: true, codigoRM: true } })).map((c) => [c.codigoRM, c.id]));

for (let mes = Number(de); mes <= Number(ate); mes++) {
  const col = cab.findIndex((v) => typeof v === "number" && Math.round(v) === serialDoMes(mes));
  if (col < 0) throw new Error(`A aba não tem a coluna de ${mes}/${ano}`);
  const c = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } }, select: { id: true } });
  await prisma.lancamentoManual.deleteMany({ where: { competenciaId: c.id } });
  let n = 0;
  for (const l of aba.linhas.slice(1)) {
    const [motivo, filial, centro, conta] = l.celulas;
    const valor = Number(l.celulas[col] ?? 0) || 0;
    if (!conta || valor === 0) continue;
    const cr = contas.get(String(conta).trim());
    if (!cr) throw new Error(`Conta ${conta} (linha ${l.numero}) fora do cadastro`);
    await lancamentosManuaisService.criar(
      ano,
      mes,
      {
        motivo: String(motivo ?? "EXTRA RN"),
        filial: Number(filial) || 1,
        centroCustoId: centro && centro !== "-" ? (centros.get(String(centro)) ?? null) : null,
        contaResultadoId: cr.id,
        descricao: cr.descricao,
        valor: valor.toFixed(2),
      },
      USUARIO,
    );
    n++;
  }
  console.log(`${String(mes).padStart(2, "0")}/${ano}: ${n} lançamento(s)`);
}
await prisma.$disconnect();
