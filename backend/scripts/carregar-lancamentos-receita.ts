/**
 * Carga, para o período de paralelo, dos lançamentos manuais de receita da aba
 * `Receita (Lanç. Manuais)` do SIG BPM 2026 - BASE PRÉVIAS (RECEITAS E
 * ESTOQUE), como se tivessem sido digitados na ferramenta. Serve para conferir
 * a receita prévia e a DRE contra a planilha; na operação, os lançamentos são
 * digitados na tela da receita prévia.
 *
 * Substitui os lançamentos de receita de todas as competências do ano: o mês
 * que saiu da aba fica sem lançamento. A coluna VENDA (G ou M) separa as
 * receitas da Matriz e da Filial em global e mercantil.
 *
 * Uso: npx tsx scripts/carregar-lancamentos-receita.ts "<BASE PRÉVIAS.xlsx>" 2026
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { getPrismaClient } from "../src/config/prisma.js";
import { Prisma } from "../src/generated/prisma/client.js";
import type { ComponenteReceita, NaturezaReceita } from "../src/generated/prisma/enums.js";
import { pedeVenda } from "../src/schemas/receitaPrevia/receitaPreviaSchemas.js";
import { lerAba } from "../src/lib/xlsx.js";

const [arquivo, anoTexto] = process.argv.slice(2);
if (!arquivo || !anoTexto) {
  console.error('Uso: npx tsx scripts/carregar-lancamentos-receita.ts "<BASE PRÉVIAS.xlsx>" 2026');
  process.exit(1);
}
const ano = Number(anoTexto);

/** CONTA DRE da aba → natureza e parte da receita. Obras não têm unidade na aba. */
const LINHAS: Record<string, { natureza: NaturezaReceita; componente: ComponenteReceita; obras?: true }> = {
  "Receita Bruta do Pré-Fabricado": { natureza: "PRE_FABRICADO", componente: "BRUTA" },
  "Receita Líquida do Pré-Fabricado": { natureza: "PRE_FABRICADO", componente: "LIQUIDA" },
  "Receita Bruta de Frete": { natureza: "FRETE", componente: "BRUTA" },
  "Receita Líquida de Frete": { natureza: "FRETE", componente: "LIQUIDA" },
  "Receita Bruta de Devoluções e Inventários": { natureza: "DEVOLUCOES_INVENTARIOS", componente: "BRUTA" },
  "Receita Líquida de Devoluções e Inventários": { natureza: "DEVOLUCOES_INVENTARIOS", componente: "LIQUIDA" },
  "Variação do Estoque": { natureza: "PRE_FABRICADO", componente: "VARIACAO_ESTOQUE" },
  "Receita Bruta de Montagem": { natureza: "MONTAGEM", componente: "BRUTA", obras: true },
  "Receita Líquida de Montagem": { natureza: "MONTAGEM", componente: "LIQUIDA", obras: true },
  "Receita Bruta Complementar": { natureza: "COMPLEMENTAR", componente: "BRUTA", obras: true },
  "Receita Líquida Complementar": { natureza: "COMPLEMENTAR", componente: "LIQUIDA", obras: true },
};

const aba = lerAba(readFileSync(arquivo), (abas) => abas.find((a) => a.normalize("NFC") === "Receita (Lanç. Manuais)".normalize("NFC")) ?? null);
const prisma = getPrismaClient();
const unidades = new Map((await prisma.unidadeNegocio.findMany({ select: { id: true, codigo: true } })).map((u) => [u.codigo, u.id]));
const competencias = new Map((await prisma.competencia.findMany({ where: { ano }, select: { id: true, mes: true } })).map((c) => [c.mes, c.id]));

const porMes = new Map<number, Prisma.LancamentoReceitaCreateManyInput[]>();
const ignorados: string[] = [];
for (const l of aba.linhas.slice(1)) {
  const [periodo, unidade, , , conta, venda, valor, observacao] = l.celulas;
  if (typeof periodo !== "number" || !conta) continue;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(periodo) * 86_400_000);
  if (d.getUTCFullYear() !== ano) continue;
  const mes = d.getUTCMonth() + 1;
  const linha = LINHAS[String(conta).trim()];
  const competenciaId = competencias.get(mes);
  const codUnidade = linha?.obras ? 3 : Number(unidade);
  if (!linha || !competenciaId || !unidades.has(codUnidade)) {
    ignorados.push(`linha ${l.numero}: ${String(conta)} (${mes}/${ano}, unidade ${unidade})`);
    continue;
  }
  const textoVenda = String(venda ?? "").trim().toUpperCase();
  const tipoVenda = textoVenda === "G" ? "GLOBAL" : textoVenda === "M" ? "MERCANTIL" : null;
  if (pedeVenda(codUnidade, linha.componente) && !tipoVenda) {
    ignorados.push(`linha ${l.numero}: ${String(conta)} sem VENDA (G ou M)`);
    continue;
  }
  const lista = porMes.get(mes) ?? [];
  lista.push({
    competenciaId,
    unidadeNegocioId: unidades.get(codUnidade)!,
    natureza: linha.natureza,
    componente: linha.componente,
    valor: new Prisma.Decimal(Number(valor) || 0).toDecimalPlaces(2),
    observacao: String(observacao ?? "Carga da planilha (paralelo)"),
    venda: pedeVenda(codUnidade, linha.componente) ? tipoVenda : null,
  });
  porMes.set(mes, lista);
}
for (const [mes, competenciaId] of [...competencias].sort((a, b) => a[0] - b[0])) {
  const lista = porMes.get(mes) ?? [];
  await prisma.$transaction([
    prisma.lancamentoReceita.deleteMany({ where: { competenciaId } }),
    prisma.lancamentoReceita.createMany({ data: lista }),
  ]);
  console.log(`${String(mes).padStart(2, "0")}/${ano}: ${lista.length} lançamento(s)`);
}
if (ignorados.length) console.log(`Ignorados: ${ignorados.length}\n  ${ignorados.slice(0, 10).join("\n  ")}`);
await prisma.$disconnect();
