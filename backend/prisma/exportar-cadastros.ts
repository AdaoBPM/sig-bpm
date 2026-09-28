/**
 * Exporta os cadastros do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO para os
 * JSON da carga inicial (prisma/carga-inicial/): centros-custo.json,
 * contas-resultado.json e dre-estrutura.json.
 *
 * A leitura é a mesma do botão "Recarregar da planilha" das telas de cadastro
 * (src/services/cadastros/carga/planilhaCadastros.ts), e é fiel: uma chave por
 * coluna, valores como texto, sem correção. Rodar de novo sempre que a
 * planilha mudar, e conferir o diff dos JSON antes de carregar.
 *
 * Uso: npx tsx prisma/exportar-cadastros.ts "<UNIDADES E CENTROS DE CUSTO.xlsx>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lerPlanilhaCadastros } from "../src/services/cadastros/carga/planilhaCadastros.js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Informe o caminho do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO.xlsx");
  process.exit(1);
}
const destino = join(dirname(fileURLToPath(import.meta.url)), "carga-inicial");
const planilha = lerPlanilhaCadastros(readFileSync(arquivo));

for (const [nome, dados] of [
  ["centros-custo.json", planilha.centros],
  ["contas-resultado.json", planilha.contas],
  ["dre-estrutura.json", planilha.dre],
] as const) {
  writeFileSync(join(destino, nome), `${JSON.stringify(dados, null, 2)}\n`);
  console.log(`${nome}: ${dados.length} registros`);
}
