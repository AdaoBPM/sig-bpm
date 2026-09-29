/**
 * Conferência do saldo de estoque (Passo 17) contra a planilha.
 *
 * Apura o saldo das competências pedidas, em ordem, e compara por obra e
 * linha com as abas Estoque (Saldo m³) e Estoque (Saldo R$) do SIG BPM 2026 -
 * BASE PRÉVIAS (RECEITAS E ESTOQUE), e os preços médios com a Estoque (Médias).
 *
 * Uso: npx tsx scripts/conferir-estoque.ts "<BASE PRÉVIAS.xlsx>" 2026 1 8
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { lerAba } from "../src/lib/xlsx.js";
import { estoqueService } from "../src/services/estoque/estoqueService.js";

const [arquivo, anoTexto, de, ate = de] = process.argv.slice(2);
if (!arquivo || !anoTexto || !de) {
  console.error('Uso: npx tsx scripts/conferir-estoque.ts "<BASE PRÉVIAS.xlsx>" 2026 1 8');
  process.exit(1);
}
const ano = Number(anoTexto);
const buf = readFileSync(arquivo);
const aba = (nome: string) => lerAba(buf, (abas) => abas.find((a) => a.normalize("NFC") === nome.normalize("NFC")) ?? null).linhas;
const serialDoMes = (mes: number) => Math.round((Date.UTC(ano, mes - 1, 1) - Date.UTC(1899, 11, 30)) / 86_400_000);

function porObra(nome: string, colEtiqueta: number) {
  const linhas = aba(nome);
  const cab = linhas[0].celulas;
  return (mes: number) => {
    const col = cab.findIndex((v) => typeof v === "number" && Math.round(v) === serialDoMes(mes));
    if (col < 0) throw new Error(`${nome} não tem a coluna de ${mes}/${ano}`);
    return new Map(linhas.slice(1).filter((l) => l.celulas[colEtiqueta]).map((l) => [String(l.celulas[colEtiqueta]).toUpperCase(), Number(l.celulas[col] ?? 0) || 0]));
  };
}
const m3 = porObra("Estoque (Saldo m³)", 18);
const rs = porObra("Estoque (Saldo R$)", 18);
const medias = aba("Estoque (Médias)");

let diferencas = 0;
for (let mes = Number(de); mes <= Number(ate); mes++) {
  const r = await estoqueService.apurar(ano, mes);
  const pm3 = m3(mes), prs = rs(mes);
  const sistema = new Map(r.saldos.map((s) => [`${s.obra}.${s.linha}`.toUpperCase(), s]));
  let difMes = 0;
  for (const k of [...new Set([...sistema.keys(), ...pm3.keys()])].sort()) {
    const s = sistema.get(k);
    const v = Number(s?.saldoVolume ?? 0), R = Number(s?.saldoValor ?? 0);
    const pv = pm3.get(k) ?? 0, pr = prs.get(k) ?? 0;
    if (Math.abs(v - pv) > 0.001 || Math.abs(R - pr) > 0.05) {
      difMes++;
      if (difMes <= 10) console.log(`  ≠ ${String(mes).padStart(2, "0")}/${ano} ${k}: sistema ${v.toFixed(3)} m³ / ${R.toFixed(2)} | planilha ${pv.toFixed(3)} m³ / ${pr.toFixed(2)}`);
    }
  }
  const col = medias[0].celulas.findIndex((v) => typeof v === "number" && Math.round(v) === serialDoMes(mes));
  const txtMedias = r.medias.map((m) => {
    const p = Number(medias.find((l) => String(l.celulas[0]).trim() === m.linha)?.celulas[col] ?? 0);
    const ok = Math.abs(p - Number(m.precoMedio)) <= 0.01;
    if (!ok) difMes++;
    return `${m.linha} ${m.precoMedio}${ok ? "" : ` ≠ ${p.toFixed(2)}`}`;
  });
  diferencas += difMes;
  console.log(`${difMes === 0 ? "✓" : "✗"} ${String(mes).padStart(2, "0")}/${ano}: ${sistema.size} saldos, ${difMes} diferença(s). Médias: ${txtMedias.join("; ")}`);
  for (const a of r.avisos) console.log(`  aviso: ${a}`);
}
console.log(diferencas === 0 ? "\nTudo confere." : `\n${diferencas} diferença(s).`);
