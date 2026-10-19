// Carrega a aba Quadro de Lotação do LISTAS REALIZADO (OPERAÇÃO) (19/10/2026) nas listas dos meses de um exercício, também
// nos fechados, sem reabri-los nem recalcular nada (ver services/importacoes/lotacao/cargaRetroativa.ts). Sem --gravar, só
// simula e mostra a conferência.
// Desenvolvimento: npx tsx scripts/carregarQuadroDeLotacao.ts "<arquivo>" 2026 1-8 [--gravar]
// Produção (com o back-up feito e a autorização do usuário): NODE_ENV=production na frente.
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { getPrismaClient } from "../src/config/prisma.js";
import { env } from "../src/config/env.js";
import { carregarLotacaoRetroativa } from "../src/services/importacoes/lotacao/cargaRetroativa.js";

const [arquivo, ano, faixa] = process.argv.slice(2);
const gravar = process.argv.includes("--gravar");
if (!arquivo || !ano || !faixa) throw new Error('Uso: npx tsx scripts/carregarQuadroDeLotacao.ts "<arquivo>" 2026 1-8 [--gravar]');
const [de, ate] = faixa.split("-").map(Number);
const meses = Array.from({ length: (ate ?? de) - de + 1 }, (_, k) => de + k);
const usuario = await getPrismaClient().usuario.findUniqueOrThrow({ where: { email: "adao.pinheiro@bpm.com.br" }, select: { id: true, nome: true } });
console.log(`Banco: ${env.DATABASE_URL} · ${gravar ? "GRAVANDO" : "simulação"} · ${meses.length} meses`);
const r = await carregarLotacaoRetroativa({ conteudo: new Uint8Array(readFileSync(arquivo)), nomeArquivo: basename(arquivo), ano: Number(ano), meses, usuario, gravar });
for (const m of r) {
  const indicador = m.indicadorTotal === null ? "sem indicador" : `indicador Quadro de Lotação Total ${m.indicadorTotal} (não muda)`;
  console.log(
    `${m.competencia} (${m.status}): ${m.situacao}${m.motivo ? ` (${m.motivo})` : ""} · ${m.centros} centros · CLT ${m.clt} + PJ ${m.pj} = ${m.total} · ${indicador}${m.substituiu ? ` · substitui ${m.substituiu}` : ""}`,
  );
}
