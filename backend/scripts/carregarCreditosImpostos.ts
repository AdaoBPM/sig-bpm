// Carrega a aba Impostos (Lista) do LISTAS REALIZADO (RESULTADOS) (04/11/2026, os Créditos de Impostos: o Creditado e o
// Estornado em R$ por unidade e conta) nos meses de um exercício, também nos fechados, sem reabri-los nem recalcular nada (ver
// services/importacoes/impostos/cargaRetroativa.ts). Sem --gravar, só simula e mostra a conferência.
// Desenvolvimento: npx tsx scripts/carregarCreditosImpostos.ts "<arquivo>" 2026 1-8 [--gravar]
// Produção (com o back-up feito e a autorização do usuário): NODE_ENV=production na frente.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { getPrismaClient } from "../src/config/prisma.js";
import { env } from "../src/config/env.js";
import { carregarCreditosRetroativos } from "../src/services/importacoes/impostos/cargaRetroativa.js";

const [arquivo, ano, faixa] = process.argv.slice(2);
const gravar = process.argv.includes("--gravar");
if (!arquivo || !ano || !faixa) throw new Error('Uso: npx tsx scripts/carregarCreditosImpostos.ts "<arquivo>" 2026 1-8 [--gravar]');
const [de, ate] = faixa.split("-").map(Number);
const meses = Array.from({ length: (ate ?? de) - de + 1 }, (_, k) => de + k);
const usuario = await getPrismaClient().usuario.findUniqueOrThrow({ where: { email: "adao.pinheiro@bpm.com.br" }, select: { id: true, nome: true } });
console.log(`Banco: ${env.DATABASE_URL?.replace(/\/\/[^@]*@/, "//…@")} · ${gravar ? "GRAVANDO" : "simulação"} · ${meses.length} meses`);
const r = await carregarCreditosRetroativos({ conteudo: new Uint8Array(readFileSync(arquivo)), nomeArquivo: basename(arquivo), ano: Number(ano), meses, usuario, gravar });
const reais = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
for (const m of r) {
  console.log(
    `${m.competencia} (${m.status}): ${m.situacao}${m.motivo ? ` (${m.motivo})` : ""} · ${m.contas} contas · Creditado R$ ${reais(m.creditado)} · Estornado R$ ${reais(m.estornado)}${m.substituiu ? ` · substitui ${m.substituiu}` : ""}`,
  );
  for (const x of m.recusadas) console.log(`  recusada: ${x}`);
  for (const x of m.ignoradas) console.log(`  ignorada (outra conta): ${x}`);
}
await getPrismaClient().$disconnect();
