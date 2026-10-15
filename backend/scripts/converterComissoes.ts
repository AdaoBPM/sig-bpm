/**
 * As comissões das premissas em % da receita bruta (15/10/2026): nos cenários analíticos já carregados, a conta das
 * comissões (CUSTO:<linha>:DVV.GGV.COMISSOES…, em R$ por unidade) vira o percentual COMISSOES:<linha> — o valor ÷ a
 * receita bruta média da linha no mesmo mês (e na Média de Referência) × 100 —, e a DRE do cenário se recalcula (igual à
 * de antes, a menos dos arredondamentos). Sem receita no mês, o percentual fica fora (a comissão era zero ou sem base).
 *
 * Uso (no backend): npx tsx scripts/converterComissoes.ts [--gravar]   (com NODE_ENV=production, no banco real)
 * Sem --gravar, só mostra o que mudaria.
 */
import { getPrismaClient } from "../src/config/prisma.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { C, calcularAnalitico } from "../src/services/cenarios/premissasCenario.js";

const gravar = process.argv.includes("--gravar");
const prisma = getPrismaClient();
const sufixo = `:${C.COMISSOES}`;
const cenarios = await prisma.cenario.findMany({ where: { tipo: "ANALITICO" }, select: { id: true, nome: true, versao: true } });
for (const c of cenarios) {
  const ps = await prisma.cenarioPremissa.findMany({ where: { cenarioId: c.id } });
  const valor = new Map(ps.map((p) => [`${p.unidade}|${p.venda}|${p.chave}|${p.mes}`, Number(p.valor)]));
  const novas: Array<{ cenarioId: string; unidade: number; venda: string; chave: string; mes: number; valor: Prisma.Decimal }> = [];
  let semReceita = 0;
  for (const p of ps.filter((x) => x.chave.startsWith("CUSTO:") && x.chave.endsWith(sufixo))) {
    const linha = p.chave.split(":")[1];
    const bruta = ps
      .filter((x) => x.unidade === p.unidade && x.venda === p.venda && x.mes === p.mes && x.chave.startsWith(`RB:${linha}:`))
      .reduce((s, x) => s + Number(x.valor), 0);
    if (!bruta) {
      if (Number(p.valor)) semReceita++;
      continue;
    }
    if (valor.has(`${p.unidade}|${p.venda}|COMISSOES:${linha}|${p.mes}`)) continue;
    novas.push({ cenarioId: c.id, unidade: p.unidade, venda: p.venda, chave: `COMISSOES:${linha}`, mes: p.mes, valor: new Prisma.Decimal(((Number(p.valor) / bruta) * 100).toFixed(6)) });
  }
  console.log(`${c.nome} VER${String(c.versao).padStart(2, "0")}: ${novas.length} percentuais${semReceita ? `; ${semReceita} comissões sem receita no mês (ficam fora)` : ""}`);
  if (!gravar || !novas.length) continue;
  await prisma.$transaction(
    async (tx) => {
      await tx.cenarioPremissa.createMany({ data: novas });
      await calcularAnalitico(tx, c.id);
    },
    { timeout: 300_000 },
  );
}
if (!gravar) console.log("Nada gravado (use --gravar).");
process.exit(0);
