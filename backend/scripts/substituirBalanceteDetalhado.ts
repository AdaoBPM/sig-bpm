// Troca o balancete agregado pelo detalhado (15/10/2026) nos meses de um exercício, sem recalcular nada (ver
// services/importacoes/balancete/substituirBalancete.ts). Sem --gravar, só simula e mostra a conferência.
// Desenvolvimento: npx tsx scripts/substituirBalanceteDetalhado.ts "<arquivo>" 2026 1-8 [--gravar]
// Produção (com o back-up feito e a autorização do usuário): NODE_ENV=production na frente.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { getPrismaClient } from "../src/config/prisma.js";
import { env } from "../src/config/env.js";
import { substituirBalanceteDetalhado } from "../src/services/importacoes/balancete/substituirBalancete.js";

const [arquivo, ano, faixa] = process.argv.slice(2);
const gravar = process.argv.includes("--gravar");
if (!arquivo || !ano || !faixa) throw new Error('Uso: npx tsx scripts/substituirBalanceteDetalhado.ts "<arquivo>" 2026 1-8 [--gravar]');
const [de, ate] = faixa.split("-").map(Number);
const meses = Array.from({ length: (ate ?? de) - de + 1 }, (_, k) => de + k);
const usuario = await getPrismaClient().usuario.findUniqueOrThrow({ where: { email: "adao.pinheiro@bpm.com.br" }, select: { id: true, nome: true } });
console.log(`Banco: ${env.DATABASE_URL} · ${gravar ? "GRAVANDO" : "simulação"} · ${meses.length} meses`);
const r = await substituirBalanceteDetalhado({ conteudo: new Uint8Array(readFileSync(arquivo)), nomeArquivo: basename(arquivo), ano: Number(ano), meses, usuario, gravar });
for (const m of r) {
  console.log(`${m.competencia}: ${m.situacao}${m.motivo ? ` (${m.motivo})` : ""} · linhas ${m.linhasAntes} → ${m.linhasDepois} · soma ${m.somaAntes} → ${m.somaDepois} · pela regra ${m.classificadosPelaRegra}${m.diferencas.length ? ` · diferenças ${JSON.stringify(m.diferencas)}` : ""}`);
}
