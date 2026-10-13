/**
 * Traz para o cadastro Estrutura dos Indicadores os indicadores novos da carga inicial (estruturaInicialIndicadores.ts)
 * e a numeração e a ordem dela — 13/10/2026: os 4 do Custo do Produto Vendido (CPV), no grupo Geral, e a renumeração
 * dos Gerais seguintes. Só mexe na ordem de todos e na numeração do grupo pedido; o resto do cadastro fica como está.
 *
 * Uso: npx tsx prisma/atualizar-estrutura-indicadores.ts [grupo] [--gravar]
 *   (o grupo padrão é Geral; sem --gravar, só lista o que mudaria)
 */
import "dotenv/config";

import { getPrismaClient } from "../src/config/prisma.js";
import { sincronizarEstruturaIndicadores } from "../src/services/relatorios/cargaEstruturaIndicadores.js";

const args = process.argv.slice(2);
const gravar = args.includes("--gravar");
const grupo = args.find((a) => !a.startsWith("--")) ?? "Geral";

const mudancas = await sincronizarEstruturaIndicadores(getPrismaClient(), grupo, !gravar);
for (const m of mudancas) console.log(`${m.campo.padEnd(6)} ${m.nome}: ${m.de !== undefined ? `${m.de} → ` : ""}${m.para}`);
console.log(`${mudancas.length} mudança(s) ${gravar ? "gravada(s)" : "(simulação; use --gravar para gravar)"}.`);
process.exit(0);
