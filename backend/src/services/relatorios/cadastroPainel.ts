import { createHash } from "node:crypto";

import { getPrismaClient } from "../../config/prisma.js";
import { quadrosDoCadastro } from "./painelDeBordo.js";

/**
 * O cadastro do Painel de Bordo (17/10/2026; Cadastros da Controladoria / Analítico / Painel de Bordo): os quadros das
 * abas Resultados e Performance montados com os itens ativos, na ordem do cadastro. O Painel de Resultados Empresariais,
 * o dos cenários e os cards dos Relatórios Executivos usam estes quadros.
 */
export async function quadrosDoPainel() {
  const itens = await getPrismaClient().painelItem.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }] });
  return quadrosDoCadastro(itens);
}

/**
 * A assinatura do cadastro (os itens, com o que muda o painel): guardada na apuração da competência; se ela muda com a
 * competência apurada e ainda aberta, a situação pede reapurar.
 */
export async function assinaturaDoPainel() {
  const itens = await getPrismaClient().painelItem.findMany({
    select: { id: true, grupo: true, quadro: true, nome: true, sigla: true, sentido: true, modelo: true, ordem: true, ativo: true },
    orderBy: { id: "asc" },
  });
  return createHash("sha1").update(JSON.stringify(itens)).digest("hex");
}
