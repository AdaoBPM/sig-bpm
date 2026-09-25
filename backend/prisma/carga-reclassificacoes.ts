/**
 * Carga inicial do cadastro de reclassificação de conta, a partir da
 * exportação da coluna CONTA (ALOC.) da planilha (exportar-reclassificacoes.ts).
 *
 * Cada linha da planilha vira um par (código do centro de custo, conta de
 * origem) → conta adotada. A mesma correção aparece uma vez por filial; ela
 * só entra uma vez, e a carga recusa o par que aponte para destinos diferentes.
 *
 * Roda depois de carga-inicial.ts, porque precisa das contas. É idempotente:
 * recria o cadastro inteiro a partir do arquivo.
 *
 * Uso: npx tsx prisma/carga-reclassificacoes.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getPrismaClient } from "../src/config/prisma.js";

type LinhaReclassificacao = {
  LINHA: number;
  FILIAL: string | null;
  COD_CUSTO: string | null;
  C_CUSTO: string | null;
  REDUZIDO_CONTA: string | null;
  CONTA: string | null;
  "CONTA (ALOC.)": string | null;
};

const prisma = getPrismaClient();
const aqui = dirname(fileURLToPath(import.meta.url));
const linhas: LinhaReclassificacao[] = JSON.parse(
  readFileSync(join(aqui, "carga-inicial", "reclassificacoes.json"), "utf8"),
);

const contas = await prisma.contaResultado.findMany({
  select: { id: true, reduzido: true },
});
const contaPorReduzido = new Map(contas.map((c) => [c.reduzido, c.id]));
const centros = new Set(
  (
    await prisma.centroCusto.findMany({
      where: { codigoRM: { not: null } },
      select: { codigoRM: true },
    })
  ).map((c) => c.codigoRM!),
);

const avisos: string[] = [];
const pares = new Map<
  string,
  { codigoCentroCusto: string; origem: string; destino: string; linhas: number[] }
>();

for (const l of linhas) {
  const codigo = l.COD_CUSTO;
  const origem = l.REDUZIDO_CONTA;
  const destino = l["CONTA (ALOC.)"];
  if (!codigo || !origem || !destino) {
    avisos.push(`linha ${l.LINHA}: sem centro, conta de origem ou destino — ignorada`);
    continue;
  }
  const chave = `${codigo}|${origem}`;
  const atual = pares.get(chave);
  if (atual && atual.destino !== destino) {
    avisos.push(
      `linha ${l.LINHA}: ${chave} já aponta para ${atual.destino} (linha ${atual.linhas[0]}) e aqui para ${destino} — mantido o primeiro`,
    );
    continue;
  }
  if (atual) atual.linhas.push(l.LINHA);
  else pares.set(chave, { codigoCentroCusto: codigo, origem, destino, linhas: [l.LINHA] });
}

await prisma.reclassificacaoConta.deleteMany({});

let gravadas = 0;
for (const [i, p] of [...pares.values()].entries()) {
  const contaOrigemId = contaPorReduzido.get(p.origem);
  const contaDestinoId = contaPorReduzido.get(p.destino);
  if (!contaOrigemId || !contaDestinoId) {
    avisos.push(
      `${p.codigoCentroCusto} | ${p.origem} → ${p.destino}: conta ${!contaOrigemId ? p.origem : p.destino} fora do cadastro — ignorada`,
    );
    continue;
  }
  if (!centros.has(p.codigoCentroCusto)) {
    avisos.push(
      `${p.codigoCentroCusto} | ${p.origem} → ${p.destino}: centro fora do cadastro — gravada mesmo assim`,
    );
  }
  await prisma.reclassificacaoConta.create({
    data: {
      codigoCentroCusto: p.codigoCentroCusto,
      contaOrigemId,
      contaDestinoId,
      motivo: `Carga inicial: CONTA (ALOC.) da planilha, linha(s) ${p.linhas.join(", ")}`,
      ordem: i + 1,
    },
  });
  gravadas++;
}

console.log(`Linhas na planilha: ${linhas.length}`);
console.log(`Pares distintos:    ${pares.size}`);
console.log(`Gravadas:           ${gravadas}`);
if (avisos.length) {
  console.log(`\nAvisos (${avisos.length}):`);
  for (const a of avisos) console.log(`  ${a}`);
}
