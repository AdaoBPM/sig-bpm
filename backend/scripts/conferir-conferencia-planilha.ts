/**
 * Conferência do relatório de conferência contra a planilha (Passo 27), pela
 * API:
 * - o SIG BPM 2026 - BASE REALIZADO (RESULTADOS) do mês: nenhuma diferença
 *   acima do limite, e as linhas sem par listadas dos dois lados;
 * - uma cópia com dois valores alterados na aba Resultados (Matriz), um em
 *   +100,00 e outro em +0,03: com o limite de 0,05 só o primeiro é destacado;
 *   com 0,01, os dois; com 200, nenhum. A diferença é ferramenta − planilha;
 * - recusas: arquivo sem as abas, arquivo que não é xlsx, mês sem coluna no
 *   arquivo, limite inválido;
 * - acesso: só o Contábil (apuracao:ler e apuracao:editar);
 * - o envio vai para o log de auditoria.
 * No fim, a planilha original é reenviada, para valer como a última.
 *
 * Uso: npx tsx scripts/conferir-conferencia-planilha.ts "<BASE REALIZADO (RESULTADOS).xlsx>" "<outro .xlsx>" 2026 8
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba } from "../src/lib/xlsx.js";

const [arquivo, outro, anoTexto = "2026", mesTexto = "8"] = process.argv.slice(2);
if (!arquivo || !outro) {
  console.error('Uso: npx tsx scripts/conferir-conferencia-planilha.ts "<BASE REALIZADO (RESULTADOS).xlsx>" "<outro .xlsx>" 2026 8');
  process.exit(1);
}
const ano = Number(anoTexto);
const mes = Number(mesTexto);
const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;
const prisma = getPrismaClient();
const SENHA = "senha-de-teste-1";
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};
const moeda = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function login(email: string, senha = SENHA) {
  const r = await request(app).post("/auth/login").send({ email, password: senha });
  return r.status === 200 ? (r.body.data.token as string) : null;
}
const admin = (await login("admin@bpm.com", "admin123"))!;
const enviar = (t: string, conteudo: Uint8Array, nome: string, am = anoMes) =>
  request(app).post(`/competencias/${am}/conferencia-planilha`).query({ nomeArquivo: nome }).set("Authorization", `Bearer ${t}`).set("Content-Type", "application/octet-stream").send(Buffer.from(conteudo));
const relatorio = async (limite?: string, t = admin) => request(app).get(`/competencias/${anoMes}/conferencia-planilha`).query(limite === undefined ? {} : { limite }).set("Authorization", `Bearer ${t}`);

type Linha = { linha: number; descricao: string; tipo: string; grupo: string; sistema: string | null; planilha: number | null; diferenca: number; destaque: boolean };
type Visao = { unidade: number; nome: string; aba: string; comparadas: number; diferencas: number; linhas: Linha[]; soNaPlanilha: Array<{ linha: number; descricao: string }>; soNoSistema: Array<{ descricao: string }> };

const original = new Uint8Array(readFileSync(arquivo));
const competencia = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } } });
if (!competencia.apuradaEm) throw new Error(`${anoMes} precisa estar apurada.`);
const inicio = new Date();
const COLUNA = `${["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"][mes - 1]}/${String(ano).slice(2)}`;

// --- 1. A planilha do mês ------------------------------------------------------
console.log(`\nPlanilha original (${basename(arquivo)}), coluna ${COLUNA}`);
const r1 = await enviar(admin, original, basename(arquivo));
ok(r1.status === 201, `enviada: ${r1.status}, ${r1.body.data?.linhas ?? r1.body.error} linhas lidas`);
const rel1 = (await relatorio()).body.data;
ok(rel1.limite === 0.05, `limite padrão de ${moeda(rel1.limite)}`);
ok(rel1.conferencia?.nomeArquivo === basename(arquivo) && rel1.conferencia?.enviadoPor === "Administrador BPM", "o relatório identifica o arquivo e quem o enviou");
for (const v of rel1.visoes as Visao[]) {
  const semPar = [...v.soNaPlanilha.map((x) => `só na planilha: linha ${x.linha} ${x.descricao}`), ...v.soNoSistema.map((x) => `só na ferramenta: ${x.descricao}`)];
  ok(v.diferencas === 0, `${v.nome} (aba ${v.aba}): ${v.comparadas} linhas, ${v.diferencas} diferença(s)${semPar.length ? `; ${semPar.join("; ")}` : ""}`);
}
ok(rel1.resumo.diferencas === 0, `total: ${rel1.resumo.comparadas} linhas comparadas, nenhuma diferença acima do limite`);

// --- 2. Uma cópia com dois valores alterados ---------------------------------
console.log("\nCópia com dois valores alterados na aba Resultados (Matriz)");
const matriz = lerAba(original, (abas) => abas.find((a) => a.normalize("NFC") === "Resultados (Matriz)".normalize("NFC")) ?? null);
const col = matriz.linhas[0].celulas.findIndex((v) => String(v ?? "").trim().toUpperCase() === COLUNA);
const letra = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const matrizRel = (rel1.visoes as Visao[]).find((v) => v.unidade === 1)!;
// Dois itens com valor, que não sejam volume.
const itens = matrizRel.linhas.filter((l) => l.tipo === "ITEM" && !["PRODUÇÃO (P)", "SERVIÇOS (S)"].includes(l.grupo) && l.planilha && Math.abs(l.planilha) > 1000).slice(0, 2);
const [grande, pequena] = itens;
const deltas = new Map([
  [grande.linha, 100],
  [pequena.linha, 0.03],
]);
const pacote = unzipSync(original);
const wb = strFromU8(pacote["xl/workbook.xml"]);
const rid = new RegExp(`<sheet [^>]*name="Resultados \\(Matriz\\)"[^>]*r:id="([^"]+)"`).exec(wb)![1];
const rels = strFromU8(pacote["xl/_rels/workbook.xml.rels"]);
const alvo = "xl/" + new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)![1].replace(/^\/?xl\//, "");
let xml = strFromU8(pacote[alvo]);
for (const [linha, delta] of deltas) {
  const re = new RegExp(`(<c r="${letra(col)}${linha}"[^>]*>(?:<f>[^<]*</f>|<f [^>]*/>|<f [^>]*>[^<]*</f>)?<v>)([^<]*)(</v>)`);
  if (!re.test(xml)) throw new Error(`célula ${letra(col)}${linha} não encontrada`);
  xml = xml.replace(re, (_m, a, v, b) => `${a}${Number(v) + delta}${b}`);
}
pacote[alvo] = strToU8(xml);
delete pacote["xl/calcChain.xml"];
const alterado = zipSync(pacote, { level: 6 });
console.log(`  linha ${grande.linha} ${grande.descricao}: +100,00; linha ${pequena.linha} ${pequena.descricao}: +0,03 (célula ${letra(col)})`);
ok((await enviar(admin, alterado, "copia alterada.xlsx")).status === 201, "a cópia alterada é enviada");

const destacadas = async (limite: string) => {
  const r = (await relatorio(limite)).body.data;
  return { r, m: (r.visoes as Visao[]).find((v) => v.unidade === 1)!.linhas.filter((l) => l.destaque) };
};
const a = await destacadas("0,05");
ok(a.m.length === 1 && a.m[0].linha === grande.linha && a.m[0].diferenca === -100, `limite 0,05: só a linha ${grande.linha} é destacada, com diferença ${a.m[0] ? moeda(a.m[0].diferenca) : "—"} (ferramenta − planilha)`);
ok(a.r.resumo.diferencas === 1, `e nenhuma outra visão muda (${a.r.resumo.diferencas} no total)`);
const pequenaLinha = (a.r.visoes as Visao[]).find((v) => v.unidade === 1)!.linhas.find((l) => l.linha === pequena.linha)!;
ok(!pequenaLinha.destaque && pequenaLinha.diferenca === -0.03, `a linha ${pequena.linha}, com ${moeda(pequenaLinha.diferenca)}, aparece sem destaque`);
const b = await destacadas("0,01");
ok(b.m.length === 2, `limite 0,01: as duas linhas são destacadas (${b.m.map((l) => l.linha).join(", ")})`);
const c = await destacadas("200");
ok(c.m.length === 0, "limite 200: nenhuma é destacada");

// --- 3. Recusas -----------------------------------------------------------------
console.log("\nRecusas");
const semAbas = await enviar(admin, new Uint8Array(readFileSync(outro)), basename(outro));
ok(semAbas.status === 400, `arquivo sem as abas Resultados (${basename(outro)}): ${semAbas.status} ${semAbas.body.error}`);
const lixo = await enviar(admin, strToU8("isto não é uma planilha"), "x.xlsx");
ok(lixo.status === 400, `arquivo que não é .xlsx: ${lixo.status} ${lixo.body.error}`);
const outraComp = await prisma.competencia.findFirst({ where: { ano: { not: ano } } });
if (outraComp) {
  const am = `${outraComp.ano}-${String(outraComp.mes).padStart(2, "0")}`;
  const semColuna = await enviar(admin, original, basename(arquivo), am);
  ok(semColuna.status === 400, `mês que o arquivo não tem (${am}): ${semColuna.status} ${semColuna.body.error}`);
}
ok((await relatorio("-1")).status === 400, "limite negativo: 400");
ok((await relatorio("abc")).status === 400, "limite que não é número: 400");

// --- 4. Acesso -----------------------------------------------------------------
console.log("\nAcesso");
const opcoes = (await request(app).get("/usuarios/opcoes").set("Authorization", `Bearer ${admin}`)).body.data;
const perfil = (codigo: string) => opcoes.perfis.find((p: { codigo: string }) => p.codigo === codigo).id as string;
const criados: string[] = [];
try {
  for (const [email, codigo, setores, departamentos] of [
    ["gestor.conferencia@bpm.com.br", "GESTAO", [], ["PRODUCAO"]],
    ["alimentador.conferencia@bpm.com.br", "ALIMENTADOR", ["PRODUCAO"], []],
  ] as const) {
    await prisma.usuario.deleteMany({ where: { email } });
    const r = await request(app).post("/usuarios").set("Authorization", `Bearer ${admin}`).send({ nome: `Teste ${email.split("@")[0]}`, email, senha: SENHA, perfilId: perfil(codigo), setores, departamentos });
    criados.push(r.body.data.id);
    const t = (await login(email))!;
    // Corpo pequeno: a recusa vem antes de o arquivo ser lido, e um arquivo grande teria a conexão cortada no meio.
    ok((await relatorio(undefined, t)).status === 403 && (await enviar(t, strToU8("x"), "x.xlsx")).status === 403, `${codigo === "GESTAO" ? "o Gestor" : "o Alimentador"} não vê nem envia: 403`);
  }
} finally {
  for (const id of criados) await prisma.usuario.delete({ where: { id } }).catch(() => undefined);
}

// --- 5. Auditoria e volta da original --------------------------------------------
console.log("\nAuditoria");
const r5 = await enviar(admin, original, basename(arquivo));
ok(r5.status === 201 && (await relatorio()).body.data.resumo.diferencas === 0, "a planilha original volta a ser a última enviada, sem diferenças");
const logs = await prisma.auditLog.findMany({ where: { acao: "CONFERENCIA_PLANILHA", createdAt: { gte: inicio } } });
ok(logs.length === 3 && logs.every((l) => l.entidadeId === anoMes && (l.metadados as { hash?: string }).hash?.length === 64), `os 3 envios aceitos estão no log, com o arquivo e o hash (${logs.length})`);

console.log(falhas === 0 ? "\nTudo confere." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
