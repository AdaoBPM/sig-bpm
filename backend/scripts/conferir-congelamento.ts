/**
 * Conferência do congelamento da apuração (Passo 21).
 *
 * Numa competência apurada:
 *  1. tira o retrato de tudo o que a apuração grava — a DRE (unidades,
 *     consolidado e centros), a receita prévia, os rateios, o estoque e a
 *     classificação de cada lançamento;
 *  2. altera um cadastro (o departamento e o rateio de um centro de custo com
 *     lançamentos no mês);
 *  3. tenta todos os caminhos que poderiam mover os valores — reclassificar,
 *     apurar só a DRE, os rateios, a receita ou o estoque, e a recarga de
 *     cadastro — e confere que nenhum valor se moveu;
 *  4. apura a competência anterior e confere que a do mês não mudou (e que ela
 *     passa a acusar a reapuração do mês anterior);
 *  5. reapura a competência: aí o cadastro novo vale (os valores mudam);
 *     desfaz o cadastro e reapura as duas, voltando ao retrato original;
 *  6. fecha, confere que a reapuração é recusada, reabre com justificativa e
 *     confere que a reabertura não mexe nos valores.
 *
 * Uso: npx tsx scripts/conferir-congelamento.ts 2026 8 [código do centro]
 */
import "dotenv/config";

import { getPrismaClient } from "../src/config/prisma.js";
import { apuracaoService } from "../src/services/apuracao/apuracaoService.js";
import { classificacaoService } from "../src/services/classificacao/classificacaoService.js";
import { dreService } from "../src/services/dre/dreService.js";
import { estoqueService } from "../src/services/estoque/estoqueService.js";
import { receitaPreviaService } from "../src/services/receitaPrevia/receitaPreviaService.js";
import { rateiosService } from "../src/services/volumes/rateiosService.js";

const USUARIO = "00000000-0000-0000-0000-000000000001"; // administrador da carga
const [anoTexto, mesTexto, codigoCentro = "1.14.00000002"] = process.argv.slice(2);
if (!anoTexto || !mesTexto) {
  console.error("Uso: npx tsx scripts/conferir-congelamento.ts 2026 8 [código do centro]");
  process.exit(1);
}
const ano = Number(anoTexto);
const mes = Number(mesTexto);
const ant = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
const prisma = getPrismaClient();
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};

/** Tudo o que a apuração grava para a competência, como chave → valor. */
async function retrato() {
  const c = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } }, select: { id: true } });
  const where = { competenciaId: c.id };
  const m = new Map<string, string>();
  for (const r of await prisma.resultadoApurado.findMany({ where, select: { unidadeNegocioId: true, centroCustoId: true, linhaDREId: true, valor: true } }))
    m.set(`dre|${r.unidadeNegocioId}|${r.centroCustoId}|${r.linhaDREId}`, r.valor.toFixed(2));
  for (const r of await prisma.receitaPrevia.findMany({ where, select: { unidadeNegocioId: true, natureza: true, receitaBruta: true, receitaLiquida: true } }))
    m.set(`receita|${r.unidadeNegocioId}|${r.natureza}`, `${r.receitaBruta.toFixed(2)}/${r.receitaLiquida.toFixed(2)}`);
  for (const r of await prisma.volumeOperacional.findMany({ where, select: { regraRateioId: true, percentual: true } })) m.set(`rateio|${r.regraRateioId}`, r.percentual.toString());
  for (const r of await prisma.estoqueSaldo.findMany({ where, select: { obraId: true, linhaTexto: true, saldoVolume: true, saldoValor: true } }))
    m.set(`estoque|${r.obraId}|${r.linhaTexto}`, `${r.saldoVolume}/${r.saldoValor}`);
  for (const r of await prisma.lancamentoContabil.findMany({
    where,
    select: { id: true, linhaDREId: true, balde: true, alocacao: true, departamento: true, atribuicao: true, contaAdotadaId: true, validacao: true },
  }))
    m.set(`lancamento|${r.id}`, `${r.linhaDREId}|${r.balde}|${r.alocacao}|${r.departamento}|${r.atribuicao}|${r.contaAdotadaId}|${r.validacao}`);
  return m;
}
const diferencas = (a: Map<string, string>, b: Map<string, string>) => {
  const ks = new Set([...a.keys(), ...b.keys()]);
  return [...ks].filter((k) => a.get(k) !== b.get(k));
};
const resumo = (ks: string[]) => {
  const t = new Map<string, number>();
  for (const k of ks) t.set(k.split("|")[0], (t.get(k.split("|")[0]) ?? 0) + 1);
  return [...t].map(([k, n]) => `${k}: ${n}`).join(", ") || "nenhuma";
};
async function recusa(nome: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(false, `${nome}: foi aceito`);
  } catch (e) {
    ok(true, `${nome}: recusado — ${(e as Error).message.slice(0, 110)}`);
  }
}

const rot = `${String(mes).padStart(2, "0")}/${ano}`;
console.log(`Congelamento da apuração de ${rot}, alterando o centro ${codigoCentro}\n`);

// 0. A competência apurada
if (!(await apuracaoService.situacao(ano, mes)).apurada) await apuracaoService.apurar(ano, mes, USUARIO);
const original = await retrato();
const centro = await prisma.centroCusto.findUniqueOrThrow({
  where: { codigoRM: codigoCentro },
  select: { id: true, nomeRM: true, balde: true, departamento: true, departamentoSigla: true },
});
const c = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } }, select: { id: true } });
const nLanc = await prisma.lancamentoContabil.count({ where: { competenciaId: c.id, centroCustoId: centro.id } });
console.log(`1. Retrato de ${rot}: ${original.size} valores. O centro ${codigoCentro} (${centro.nomeRM}) tem ${nLanc} lançamento(s) no mês.`);

// 2. Altera o cadastro
// Rateio por PRODUCAO: os lançamentos do centro deixam de ser diretos da Filial e passam a ser rateados
// entre Matriz e Filial pela produção — um cadastro que, reapurado, move a DRE.
const alterado = { balde: "PRODUCAO" as const };
await prisma.centroCusto.update({ where: { id: centro.id }, data: alterado });
console.log(`2. Cadastro alterado: rateio ${centro.balde} → ${alterado.balde}`);
try {
  // 3. Nada se move
  console.log("3. Caminhos que poderiam mover os valores:");
  await recusa("reclassificar a competência", () => classificacaoService.reclassificar(ano, mes));
  await recusa("apurar só a DRE", () => dreService.apurar(ano, mes, USUARIO));
  await recusa("apurar só os rateios", () => rateiosService.apurar(ano, mes));
  await recusa("apurar só a receita prévia", () => receitaPreviaService.apurar(ano, mes));
  await recusa("apurar só o estoque", () => estoqueService.apurar(ano, mes));
  const naRecarga = await prisma.competencia.count({ where: { id: c.id, status: { not: "FECHADA" }, apuradaEm: null } });
  ok(naRecarga === 0, "a recarga de cadastro não reclassifica a competência apurada");
  const d3 = diferencas(original, await retrato());
  ok(d3.length === 0, `nenhum valor se moveu (diferenças: ${resumo(d3)})`);

  // 4. Apurar outra competência não mexe nesta
  console.log(`4. Apura ${String(ant.mes).padStart(2, "0")}/${ant.ano}:`);
  await apuracaoService.apurar(ant.ano, ant.mes, USUARIO);
  const d4 = diferencas(original, await retrato());
  ok(d4.length === 0, `${rot} não mudou (diferenças: ${resumo(d4)})`);
  const s4 = await apuracaoService.situacao(ano, mes);
  ok(s4.mudancas.some((x) => x.includes("reapurada depois")), `${rot} acusa: "${s4.mudancas.join(" ")}"`);
  ok(!s4.podeFechar, `${rot} não pode ser fechada assim (${s4.motivosNaoFechar.join(" ")})`);

  // 5. Reapurar aplica o cadastro novo
  console.log(`5. Reapura ${rot} com o cadastro alterado:`);
  await apuracaoService.apurar(ano, mes, USUARIO);
  const d5 = diferencas(original, await retrato());
  ok(d5.length > 0, `o cadastro novo passou a valer (diferenças: ${resumo(d5)})`);
} finally {
  await prisma.centroCusto.update({
    where: { id: centro.id },
    data: { balde: centro.balde, departamento: centro.departamento, departamentoSigla: centro.departamentoSigla },
  });
  console.log("   Cadastro restaurado; reapura as duas competências.");
  await apuracaoService.apurar(ant.ano, ant.mes, USUARIO);
  await apuracaoService.apurar(ano, mes, USUARIO);
}
const d5b = diferencas(original, await retrato());
ok(d5b.length === 0, `de volta ao retrato original (diferenças: ${resumo(d5b)})`);

// 6. Fechar e reabrir
console.log("6. Fechamento e reabertura:");
const f = await apuracaoService.fechar(ano, mes, USUARIO);
ok(f.competencia.status === "FECHADA", `fechada por ${f.fechadaPor}`);
await recusa("reapurar a competência fechada", () => apuracaoService.apurar(ano, mes, USUARIO));
await recusa("reabrir sem explicar", () => apuracaoService.reabrir(ano, mes, "teste", USUARIO));
const r = await apuracaoService.reabrir(ano, mes, "Teste do Passo 21: conferência automática do congelamento.", USUARIO);
ok(r.competencia.status === "ABERTA" && r.reaberturas.length > 0, `reaberta, com ${r.reaberturas.length} reabertura(s) registrada(s)`);
const d6 = diferencas(original, await retrato());
ok(d6.length === 0, `a reabertura não mexeu nos valores (diferenças: ${resumo(d6)})`);
await apuracaoService.apurar(ano, mes, USUARIO);
const s6 = await apuracaoService.situacao(ano, mes);
ok(s6.competencia.status === "EM_CONFERENCIA" && s6.mudancas.length === 0, `reapurada: ${s6.competencia.status}, ${s6.apuracoes} apuração(ões)`);

console.log(falhas === 0 ? "\nO congelamento funciona: nenhum valor se move sem reapuração." : `\n${falhas} verificação(ões) falharam.`);
await prisma.$disconnect();
