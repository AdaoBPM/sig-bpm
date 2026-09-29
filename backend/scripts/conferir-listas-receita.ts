/**
 * Conferência das listas da receita prévia (Passo 12b) contra a planilha.
 *
 * Lê as três listas do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO) com as
 * regras da importação, mês a mês, e compara com o que a planilha calcula:
 *  - Devoluções e Saídas: com as abas `Devoluções (Resumo)` e `Saídas (Resumo)`,
 *    por etiqueta (período, projeto, linha e movimento), valor e deduções;
 *  - Medições, que não têm resumo: com a `Receita (Serviços)` do
 *    SIG BPM 2026 - BASE PRÉVIAS (RECEITAS E ESTOQUE).
 *
 * Uso: npx tsx scripts/conferir-listas-receita.ts "<LISTAS (OPERAÇÃO).xlsx>" "<BASE PRÉVIAS.xlsx>" 1 8
 */
import { readFileSync } from "node:fs";

import { lerAba, type LinhaPlanilha } from "../src/lib/xlsx.js";
import { DEFINICOES_LISTAS_RECEITA, type TipoListaReceita } from "../src/services/importacoes/listas/definicoesListasReceita.js";
import type { RegistroLista } from "../src/services/importacoes/listas/leituraListas.js";
import { Prisma } from "../src/generated/prisma/client.js";

const [arqListas, arqPrevias, de = "1", ate = "8"] = process.argv.slice(2);
if (!arqListas || !arqPrevias) {
  console.error('Uso: npx tsx scripts/conferir-listas-receita.ts "<LISTAS (OPERAÇÃO).xlsx>" "<BASE PRÉVIAS.xlsx>" [mês inicial] [mês final]');
  process.exit(1);
}
const listas = readFileSync(arqListas);
const previas = readFileSync(arqPrevias);
const aba = (buf: Buffer, nome: string) =>
  lerAba(buf, (abas) => abas.find((a) => a.normalize("NFC") === nome.normalize("NFC")) ?? null).linhas;
const meses = Array.from({ length: Number(ate) - Number(de) + 1 }, (_, i) => Number(de) + i);
const D = (v: unknown) => new Prisma.Decimal(typeof v === "number" ? v : Number(v ?? 0) || 0);
const mm = (m: number) => `${String(m).padStart(2, "0")}/2026`;
const serial = (v: unknown) => {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(v)) * 86_400_000);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

function ler(tipo: TipoListaReceita) {
  const def = DEFINICOES_LISTAS_RECEITA[tipo];
  const linhas = aba(listas, def.abas[0]);
  const porMes = new Map<number, RegistroLista[]>();
  const rejeicoes: string[] = [];
  for (const m of meses) {
    const l = def.interpretar(linhas, 2026, m);
    if (!l.ok) throw new Error(`${tipo}: ${l.motivo}`);
    porMes.set(m, l.registros);
    for (const r of l.rejeicoes) rejeicoes.push(`${mm(m)} linha ${r.linha}: ${r.mensagem}`);
  }
  return { porMes, rejeicoes };
}

type Par = [Prisma.Decimal, Prisma.Decimal];
function comparar(titulo: string, sistema: Map<string, Par>, planilha: Map<string, Par>, rotulos: [string, string]) {
  let dif = 0;
  const chaves = [...new Set([...sistema.keys(), ...planilha.keys()])].sort();
  for (const k of chaves) {
    const s = sistema.get(k), p = planilha.get(k);
    const ok = s && p && s[0].minus(p[0]).abs().lte(0.01) && s[1].minus(p[1]).abs().lte(0.01);
    if (!ok) {
      dif++;
      if (dif <= 15) {
        console.log(`  ≠ ${k}: sistema ${s ? `${s[0].toFixed(2)} / ${s[1].toFixed(2)}` : "(ausente)"} | planilha ${p ? `${p[0].toFixed(2)} / ${p[1].toFixed(2)}` : "(ausente)"}`);
      }
    }
  }
  const tot = (m: Map<string, Par>, i: 0 | 1) => [...m.values()].reduce((a, v) => a.plus(v[i]), new Prisma.Decimal(0)).toFixed(2);
  console.log(
    `${dif === 0 ? "✓" : "✗"} ${titulo}: ${chaves.length} chave(s), ${dif} diferença(s). ` +
      `${rotulos[0]} ${tot(sistema, 0)} × ${tot(planilha, 0)}; ${rotulos[1]} ${tot(sistema, 1)} × ${tot(planilha, 1)} (sistema × planilha)`,
  );
}
const acumular = (m: Map<string, Par>, k: string, a: Prisma.Decimal, b: Prisma.Decimal) => {
  const v = m.get(k) ?? [new Prisma.Decimal(0), new Prisma.Decimal(0)];
  m.set(k, [v[0].plus(a), v[1].plus(b)]);
};
const dentro = (periodo: string) => meses.some((m) => mm(m) === periodo);

/** Resumo por etiqueta (colunas Período, Valor, Deduções e Etiqueta). */
function resumo(linhas: LinhaPlanilha[], colValor: number, colDeducoes: number, colEtiqueta: number) {
  const m = new Map<string, Par>();
  for (const l of linhas.slice(1)) {
    const e = l.celulas[colEtiqueta];
    if (!e || e === "-") continue;
    const k = String(e);
    if (!dentro(k.slice(0, 7))) continue;
    acumular(m, k, D(l.celulas[colValor]), D(l.celulas[colDeducoes]));
  }
  return m;
}

// Devoluções e Saídas ---------------------------------------------------------
for (const [tipo, abaResumo, rotuloLinha] of [
  ["DEVOLUCAO", "Devoluções (Resumo)", (l: string) => l],
  ["SAIDA", "Saídas (Resumo)", (l: string) => (l === "METALÚRGICA" ? "METALURGIA" : l)],
] as const) {
  const { porMes, rejeicoes } = ler(tipo);
  const sistema = new Map<string, Par>();
  for (const [m, rs] of porMes) {
    for (const r of rs) {
      const k = `${mm(m)}.${r.obra?.codigo ?? ""}.${rotuloLinha(r.linha!.codigo)}.${r.campos.movimento}`;
      acumular(sistema, k, r.campos.valor as Prisma.Decimal, r.campos.creditos as Prisma.Decimal);
    }
  }
  comparar(`${DEFINICOES_LISTAS_RECEITA[tipo].rotulo} × ${abaResumo}`, sistema, resumo(aba(listas, abaResumo), 6, 7, 8), ["valor", "deduções"]);
  for (const r of rejeicoes.slice(0, 5)) console.log(`  rejeitada: ${r}`);
}

// Medições × Receita (Serviços) -------------------------------------------------
{
  const { porMes, rejeicoes } = ler("MEDICAO");
  const sistema = new Map<string, Par>();
  for (const [m, rs] of porMes) for (const r of rs) acumular(sistema, `${mm(m)}.${r.obra?.codigo}.${r.linha?.codigo}`, r.campos.valorMedido as Prisma.Decimal, r.quantidade);
  const planilha = new Map<string, Par>();
  for (const l of aba(previas, "Receita (Serviços)").slice(1)) {
    const [periodo, projeto, , , , linha] = l.celulas;
    if (!periodo || typeof periodo !== "number") continue;
    const p = serial(periodo);
    if (!dentro(p)) continue;
    acumular(planilha, `${p}.${projeto}.${String(linha ?? "").trim().toUpperCase()}`, D(l.celulas[11]), D(l.celulas[10]));
  }
  comparar("Medições × Receita (Serviços) do BASE PRÉVIAS", sistema, planilha, ["ROB serviços", "exec. dif."]);
  for (const r of rejeicoes.slice(0, 5)) console.log(`  rejeitada: ${r}`);
}
