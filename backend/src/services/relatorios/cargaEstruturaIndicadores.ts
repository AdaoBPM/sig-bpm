import type { getPrismaClient } from "../../config/prisma.js";
import { ESTRUTURA_INICIAL_INDICADORES } from "./estruturaInicialIndicadores.js";

/** Grava os indicadores da carga inicial que ainda não estão no cadastro (pelo nome); os já cadastrados ficam como estão. */
export async function carregarEstruturaIndicadores(prisma: ReturnType<typeof getPrismaClient>) {
  const existentes = new Set((await prisma.indicadorEstrutura.findMany({ select: { nome: true } })).map((i) => i.nome));
  let criados = 0;
  for (const [i, ind] of ESTRUTURA_INICIAL_INDICADORES.entries()) {
    if (existentes.has(ind.nome)) continue;
    await prisma.indicadorEstrutura.create({ data: { ...ind, ordem: i + 1 } });
    criados++;
  }
  return { total: ESTRUTURA_INICIAL_INDICADORES.length, criados };
}
