/**
 * Conferência da classificação contra a planilha, para o período de paralelo.
 *
 * Para cada lançamento da competência no sistema, localiza a linha da aba
 * `Gastos (Contábil)` do BASE REALIZADO (RESULTADOS) pela chave filial +
 * centro de custo + conta, e compara a conta adotada, a verificação, a
 * alocação, o rateio e a etiqueta.
 *
 * Uso: npx tsx scripts/conferir-classificacao.ts "<RESULTADOS.xlsx>" 2026 1
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba, type ValorCelula } from "../src/lib/xlsx.js";

const [arquivo, anoTexto, mesTexto] = process.argv.slice(2);
if (!arquivo || !anoTexto || !mesTexto) {
  console.error("Uso: npx tsx scripts/conferir-classificacao.ts <RESULTADOS.xlsx> <ano> <mes>");
  process.exit(1);
}
const ano = Number(anoTexto);
const mes = Number(mesTexto);

const VERIFICACAO: Record<string, string> = {
  "-": "OK",
  "<ERRO!>": "ERRO_PARAMETRIZACAO",
  "<DEP.!>": "ERRO_DEPARTAMENTO",
  "<ATR.!>": "ERRO_ATRIBUICAO",
};
const ROTULO_BALDE: Record<string, string> = { PRODUCAO: "PRODUÇÃO" };

const aba = lerAba(readFileSync(arquivo), (abas) =>
  abas.includes("Gastos (Contábil)") ? "Gastos (Contábil)" : null,
);
const cab = aba.linhas[0].celulas.map((c) => String(c ?? "").trim());
const col = (n: string) => cab.indexOf(n);
const txt = (v: ValorCelula | undefined) =>
  v === null || v === undefined || String(v).trim() === "" || String(v) === "0"
    ? null
    : String(v).trim();

const planilha = new Map<string, { linha: number; valores: Record<string, string | null> }>();
for (const l of aba.linhas.slice(1)) {
  const c = l.celulas;
  const reduzido = txt(c[col("REDUZIDO_CONTA")]);
  if (!reduzido) continue;
  const chave = `${txt(c[col("FILIAL")])}|${txt(c[col("COD_CUSTO")]) ?? ""}|${reduzido}`;
  planilha.set(chave, {
    linha: l.numero,
    valores: {
      conta: txt(c[col("CONTA (ADOT.)")]),
      verificacao: txt(c[col("LANÇ. OK?")]),
      alocacao: txt(c[col("ALOCAÇÃO")]),
      rateio: txt(c[col("RATEIO")]),
      etiqueta: txt(c[col("ETIQUETA")]),
    },
  });
}

const prisma = getPrismaClient();
const competencia = await prisma.competencia.findUniqueOrThrow({
  where: { ano_mes: { ano, mes } },
});
const lancamentos = await prisma.lancamentoContabil.findMany({
  where: { competenciaId: competencia.id },
  select: {
    filial: true,
    codigoCentroCusto: true,
    nomeCentroCusto: true,
    validacao: true,
    alocacao: true,
    balde: true,
    etiqueta: true,
    contaResultado: { select: { reduzido: true } },
    contaAdotada: { select: { reduzido: true } },
  },
});

const diferencas = new Map<string, string[]>();
let semLinha = 0;
for (const l of lancamentos) {
  const chave = `${l.filial}|${l.codigoCentroCusto ?? ""}|${l.contaResultado.reduzido}`;
  const p = planilha.get(chave);
  if (!p) {
    semLinha++;
    continue;
  }
  const sistema = {
    conta: l.contaAdotada?.reduzido ?? null,
    verificacao: l.validacao,
    alocacao: l.alocacao,
    rateio: l.balde ? (ROTULO_BALDE[l.balde] ?? l.balde) : "-",
    etiqueta: l.etiqueta,
  };
  const esperado = {
    ...p.valores,
    verificacao: VERIFICACAO[p.valores.verificacao ?? "-"] ?? p.valores.verificacao,
    rateio: p.valores.rateio ?? "-",
  };
  for (const campo of Object.keys(sistema) as Array<keyof typeof sistema>) {
    if (String(sistema[campo]) !== String(esperado[campo])) {
      const lista = diferencas.get(campo) ?? [];
      lista.push(
        `linha ${p.linha} ${chave} (${l.nomeCentroCusto ?? "sem centro"}): sistema ${sistema[campo]} × planilha ${esperado[campo]}`,
      );
      diferencas.set(campo, lista);
    }
  }
}

console.log(`Competência ${String(mes).padStart(2, "0")}/${ano}: ${lancamentos.length} lançamentos`);
console.log(`Sem linha correspondente na planilha: ${semLinha}`);
if (diferencas.size === 0) console.log("Nenhuma diferença.");
for (const [campo, lista] of diferencas) {
  console.log(`\n${campo}: ${lista.length} diferença(s)`);
  // Agrupa por par "sistema × planilha": diferença sistemática vira uma linha só.
  const pares = new Map<string, number>();
  for (const d of lista) {
    const par = d.slice(d.indexOf(": sistema ") + 2);
    pares.set(par, (pares.get(par) ?? 0) + 1);
  }
  for (const [par, n] of [...pares].sort((x, y) => y[1] - x[1]).slice(0, 8)) {
    console.log(`  ${String(n).padStart(4)} × ${par.length > 110 ? `${par.slice(0, 110)}…` : par}`);
  }
  console.log("  exemplos:");
  for (const d of lista.slice(0, 15)) console.log(`  ${d}`);
  if (lista.length > 15) console.log(`  … e mais ${lista.length - 15}`);
}
