/**
 * Carga dos cadastros a partir dos JSON versionados em prisma/carga-inicial/
 * (centros de custo, contas de resultado e estrutura da DRE, com o vínculo das
 * contas às linhas). A lógica é a mesma do botão "Recarregar da planilha" das
 * telas de cadastro: src/services/cadastros/carga/.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getPrismaClient } from "../src/config/prisma.js";
import { ajustesPrevistos } from "../src/services/cadastros/carga/ajustesCarga.js";
import { gravarCadastros } from "../src/services/cadastros/carga/aplicarCarga.js";
import type { PlanilhaCadastros } from "../src/services/cadastros/carga/planilhaCadastros.js";
import { prepararCadastros } from "../src/services/cadastros/carga/prepararCadastros.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const lerJson = <T>(arquivo: string): T[] => JSON.parse(readFileSync(join(aqui, "carga-inicial", arquivo), "utf8"));

export async function carregarCadastrosDaPasta() {
  const planilha: PlanilhaCadastros = {
    centros: lerJson("centros-custo.json"),
    contas: lerJson("contas-resultado.json"),
    dre: lerJson("dre-estrutura.json"),
  };
  const preparado = prepararCadastros(planilha);
  const r = await getPrismaClient().$transaction((tx) => gravarCadastros(tx, preparado), { timeout: 120_000 });

  console.log(
    `Centros de custo    : ${r.centros} gravados, ${preparado.centros.descartados} descartados por ajuste, ` +
      `${preparado.centros.ignorados} ignorados (de ${preparado.centros.lidos} lidos), ${r.centrosRemovidos} removidos`,
  );
  console.log(`Contas de resultado : ${r.contas} gravadas, ${preparado.contas.ignorados} ignoradas (de ${preparado.contas.lidos} lidas)`);
  console.log(`Estrutura da DRE    : ${r.linhasDRE} linhas, ${r.linhasRemovidas} removidas de cargas anteriores`);
  console.log(`Contas vinculadas a uma linha da DRE: ${r.contasVinculadas}`);
  if (preparado.semDestino.length > 0) {
    console.log(`Contas com destino declarado mas sem linha correspondente: ${preparado.semDestino.length}`);
    for (const s of preparado.semDestino.slice(0, 10)) console.log(`  ${s}`);
  }

  // Ajuste previsto sem correspondência: a planilha já foi corrigida, e a
  // entrada pode sair de ajustesCarga.ts.
  const previstos = ajustesPrevistos();
  const obsoletos = previstos.filter((a) => !preparado.ajustesUsados.has(a.chave));
  console.log(`\nAjustes aplicados: ${previstos.length - obsoletos.length} de ${previstos.length}`);
  for (const o of obsoletos) console.log(`  sem correspondência (planilha já corrigida?): ${o.descricao}`);

  if (preparado.avisos.length > 0) {
    console.log(`\n${preparado.avisos.length} aviso(s):`);
    for (const a of preparado.avisos.slice(0, 20)) console.log(`  [${a.origem}] ${a.chave}: ${a.motivo}`);
  }
  return r;
}
