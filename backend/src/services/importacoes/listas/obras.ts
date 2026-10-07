import type { PrismaClient } from "../../../generated/prisma/client.js";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Obras de estoque sem projeto vendido, valoradas por tabela (SPEC, Obra). */
const OBRAS_GENERICAS = new Set(["G11", "M2", "M3", "M9999"]);

/**
 * Garante que cada obra citada nas listas exista no cadastro e devolve o id
 * por código. A obra nasce na primeira importação que a cita:
 *
 *  - venda GLOBAL quando a sigla começa com "G" — a regra da coluna Venda da
 *    Projetos (Resumo); MERCANTIL nos demais casos;
 *  - genérica para as obras de estoque;
 *  - nome da primeira lista que a trouxe. O nome não é sobrescrito depois,
 *    porque cada lista abrevia de um jeito ("ABIMAR" e "ABIMAR | AMPLIAÇÃO
 *    LOJA IÇARA" são a mesma obra) e ele ficaria mudando a cada importação.
 *    A obra que nasceu sem nome (a DRE do Comercial só traz o código) recebe
 *    o da primeira lista que o trouxer.
 *
 * A situação diante do contrato (SEM_CONTRATO, INCONSISTENTE) é apurada no
 * Passo 14, com a DRE do Comercial.
 */
export async function garantirObras(
  tx: Tx,
  obras: Map<string, string | null>,
): Promise<{ porCodigo: Map<string, string>; criadas: number }> {
  const codigos = [...obras.keys()];
  const existentes = await tx.obra.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true, codigo: true, nome: true },
  });
  const porCodigo = new Map(existentes.map((o) => [o.codigo, o.id]));
  for (const o of existentes) {
    const nome = obras.get(o.codigo)?.trim();
    if (nome && nome !== o.codigo && (!o.nome || o.nome === o.codigo)) await tx.obra.update({ where: { id: o.id }, data: { nome } });
  }

  const novas = codigos.filter((c) => !porCodigo.has(c));
  if (novas.length > 0) {
    await tx.obra.createMany({
      data: novas.map((codigo) => {
        const generica = OBRAS_GENERICAS.has(codigo.toUpperCase());
        return {
          codigo,
          nome: obras.get(codigo)?.trim() || codigo,
          tipoVenda: codigo.toUpperCase().startsWith("G") ? ("GLOBAL" as const) : ("MERCANTIL" as const),
          generica,
          situacaoCadastro: generica ? ("GENERICA" as const) : ("OK" as const),
        };
      }),
    });
    const criadas = await tx.obra.findMany({
      where: { codigo: { in: novas } },
      select: { id: true, codigo: true },
    });
    for (const o of criadas) porCodigo.set(o.codigo, o.id);
  }
  return { porCodigo, criadas: novas.length };
}
