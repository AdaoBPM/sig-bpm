/**
 * Exporta as reclassificações manuais da planilha para a carga inicial.
 *
 * Origem: SIG BPM 2026 - BASE REALIZADO (RESULTADOS), aba `Gastos (Contábil)`,
 * coluna `CONTA (ALOC.)` — a conta digitada à mão que substitui a do balancete
 * quando o lançamento caiu em conta de outro departamento ou atribuição.
 *
 * Na planilha a correção está presa à POSIÇÃO da linha, ao lado de uma fórmula
 * que puxa o balancete; aqui ela vira par (centro de custo, conta de origem) →
 * conta adotada. A exportação é fiel: uma entrada por linha da planilha, com a
 * filial e os nomes, para a conferência. A deduplicação é da carga.
 *
 * Uso: npx tsx prisma/exportar-reclassificacoes.ts "<caminho do RESULTADOS.xlsx>"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { lerAba, type ValorCelula } from "../src/lib/xlsx.js";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Informe o caminho do BASE REALIZADO (RESULTADOS).xlsx");
  process.exit(1);
}

const aba = lerAba(readFileSync(arquivo), (abas) =>
  abas.includes("Gastos (Contábil)") ? "Gastos (Contábil)" : null,
);
const cabecalho = aba.linhas[0].celulas.map((c) => String(c ?? "").trim());
const col = (nome: string) => {
  const i = cabecalho.indexOf(nome);
  if (i < 0) throw new Error(`Coluna ${nome} não encontrada em Gastos (Contábil)`);
  return i;
};
const COLUNAS = ["FILIAL", "COD_CUSTO", "C_CUSTO", "REDUZIDO_CONTA", "CONTA", "CONTA (ALOC.)"];
const indices = COLUNAS.map(col);

const texto = (v: ValorCelula | undefined) =>
  v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim();

const saida = [];
for (const linha of aba.linhas.slice(1)) {
  const valores = indices.map((i) => texto(linha.celulas[i]));
  if (!valores[5]) continue;
  saida.push({
    LINHA: linha.numero,
    ...Object.fromEntries(COLUNAS.map((c, i) => [c, valores[i]])),
  });
}

const destino = join(dirname(fileURLToPath(import.meta.url)), "carga-inicial", "reclassificacoes.json");
writeFileSync(destino, `${JSON.stringify(saida, null, 2)}\n`);
console.log(`${saida.length} reclassificações exportadas para ${destino}`);
