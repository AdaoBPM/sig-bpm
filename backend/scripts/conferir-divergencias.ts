/**
 * Conferência da detecção de divergência retroativa (Passo 24), pela API.
 *
 * 1. Fecha a competência pedida (apurada) e gera uma cópia do balancete com
 *    duas linhas do mês alteradas (+1.000,00 e −500,00, ajustando o Total
 *    Geral para o arquivo continuar consistente).
 * 2. Reimporta o balancete alterado na competência fechada: a importação só
 *    compara; as duas diferenças viram divergências, e a competência não muda
 *    (lançamentos, estado e DRE apurada iguais).
 * 3. Importa o mesmo arquivo no mês seguinte (aberto): os meses fechados que
 *    vêm nele são comparados, e as diferenças já registradas não se repetem.
 * 4. O aviso ao entrar conta as abertas; o Gestor só vê as dos seus
 *    departamentos; justificar e resolver por reabertura registram autor e
 *    justificativa, e ficam no log de auditoria.
 * 5. Preço de contrato: a substituição do preço que valorou a receita apurada
 *    vira divergência com o efeito na receita, e a reapuração a resolve.
 * No fim as competências voltam a ficar apuradas.
 *
 * Uso: npx tsx scripts/conferir-divergencias.ts "<LISTAS REALIZADO (RESULTADOS).xlsx>" 2026 7
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { lerAba } from "../src/lib/xlsx.js";
import { detectarPrecos } from "../src/services/divergencias/divergenciasService.js";
import { ABA_BALANCETE, interpretarBalancete } from "../src/services/importacoes/balancete/leiauteBalancete.js";

const [arquivo, anoTexto = "2026", mesTexto = "7"] = process.argv.slice(2);
if (!arquivo) {
  console.error('Uso: npx tsx scripts/conferir-divergencias.ts "<LISTAS REALIZADO (RESULTADOS).xlsx>" 2026 7');
  process.exit(1);
}
const ano = Number(anoTexto);
const mes = Number(mesTexto);
const am = (m: number) => `${ano}-${String(m).padStart(2, "0")}`;
const prisma = getPrismaClient();
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const login = async (email: string, senha: string) => (await request(app).post("/auth/login").send({ email, password: senha })).body.data;
const admin = (await login("admin@bpm.com", "admin123")).token as string;
const api = {
  get: (url: string, t = admin) => request(app).get(url).set("Authorization", `Bearer ${t}`),
  post: (url: string, body?: object, t = admin) => request(app).post(url).set("Authorization", `Bearer ${t}`).send(body ?? {}),
};
async function importar(competencia: string, conteudo: Uint8Array) {
  const r = await request(app)
    .post(`/competencias/${competencia}/importacoes?tipo=BALANCETE&nomeArquivo=balancete-alterado.xlsx&forcar=1`)
    .set("Authorization", `Bearer ${admin}`)
    .set("Content-Type", "application/octet-stream")
    .send(Buffer.from(conteudo));
  if (r.status !== 202) throw new Error(`importar em ${competencia}: ${r.status} ${JSON.stringify(r.body)}`);
  for (let i = 0; i < 240; i++) {
    await espera(1000);
    const d = (await api.get(`/importacoes/${r.body.data.id}`)).body.data;
    if (d.status !== "PROCESSANDO") return d;
  }
  throw new Error("importação não terminou");
}
/** Tudo o que a competência tem gravado, como texto: lançamentos, estado e DRE apurada. */
async function retrato(competencia: string) {
  const c = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano: Number(competencia.slice(0, 4)), mes: Number(competencia.slice(5)) } }, select: { id: true, status: true, apuradaEm: true } });
  const l = await prisma.lancamentoContabil.aggregate({ where: { competenciaId: c.id }, _count: true, _sum: { valorMovimento: true } });
  const d = await prisma.resultadoApurado.findMany({ where: { competenciaId: c.id }, select: { valor: true }, orderBy: { id: "asc" } });
  return { status: c.status, apuradaEm: c.apuradaEm?.toISOString(), lancamentos: `${l._count}/${l._sum.valorMovimento?.toFixed(2)}`, dre: d.map((x) => x.valor.toFixed(2)).join(",") };
}

// --- Balancete alterado --------------------------------------------------
const original = readFileSync(arquivo);
const aba = lerAba(original, (abas) => abas.find((a) => a === ABA_BALANCETE) ?? null);
const cabecalho = aba.linhas.find((l) => l.celulas.some((c) => String(c ?? "").trim().toUpperCase() === "REDUZIDO_CONTA"))!;
const leitura = interpretarBalancete(aba.linhas, ano, mes);
if (!leitura.ok) throw new Error(leitura.motivo);
// As três colunas do mês (crédito, débito, movimentação): as do cabeçalho que a leitura usou.
const colunasDoMes = cabecalho.celulas
  .map((v, i) => ({ v, i }))
  .filter(({ v }) => {
    const t = String(v ?? "");
    const s = `/${String(mes).padStart(2, "0")}/${ano}`;
    return t.includes(s) || (typeof v === "number" && new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().startsWith(`${ano}-${String(mes).padStart(2, "0")}`));
  })
  .map(({ i }) => i);
if (colunasDoMes.length !== 3) throw new Error(`esperava 3 colunas do mês, achei ${colunasDoMes.length}`);
const [colCred, , colMov] = colunasDoMes;
const alvos = leitura.lancamentos.filter((l) => l.valorMovimento.abs().greaterThan(1000)).slice(0, 2);
// Os centavos mudam a cada execução: uma diferença já registrada com o mesmo
// valor recebido não volta a entrar (regra da detecção), e a conferência tem de
// poder ser repetida.
const centavos = (Date.now() % 9000) / 100;
const deltas = [Math.round((1000 + centavos) * 100) / 100, -Math.round((500 + centavos) * 100) / 100];
const linhaTotal = aba.linhas.find((l) => String(l.celulas[0] ?? "").trim().toUpperCase() === "TOTAL GERAL")!;
const letra = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const arquivos = unzipSync(original);
const wb = strFromU8(arquivos["xl/workbook.xml"]);
const rid = new RegExp(`<sheet [^>]*name="${ABA_BALANCETE.replace(/[()]/g, "\\$&")}"[^>]*r:id="([^"]+)"`).exec(wb)![1];
const rels = strFromU8(arquivos["xl/_rels/workbook.xml.rels"]);
const alvoXml = "xl/" + new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)![1].replace(/^\/?xl\//, "");
let xml = strFromU8(arquivos[alvoXml]);
const somar = (celula: string, delta: number) => {
  const re = new RegExp(`(<c r="${celula}"[^>]*>(?:<f>[^<]*</f>)?<v>)([^<]*)(</v>)`);
  if (!re.test(xml)) throw new Error(`célula ${celula} não encontrada`);
  xml = xml.replace(re, (_m, a, v, b) => `${a}${new Prisma.Decimal(v).plus(delta).toString()}${b}`);
};
alvos.forEach((l, k) => {
  somar(`${letra(colCred)}${l.linhaArquivo}`, deltas[k]);
  somar(`${letra(colMov)}${l.linhaArquivo}`, deltas[k]);
});
const somaDeltas = deltas.slice(0, alvos.length).reduce((a, b) => a + b, 0);
somar(`${letra(colCred)}${linhaTotal.numero}`, somaDeltas);
somar(`${letra(colMov)}${linhaTotal.numero}`, somaDeltas);
arquivos[alvoXml] = strToU8(xml);
delete arquivos["xl/calcChain.xml"];
const alterado = zipSync(arquivos, { level: 6 });
console.log(`Balancete alterado em ${am(mes)}: ${alvos.map((l, k) => `linha ${l.linhaArquivo} (filial ${l.filial}, centro ${l.codigoCentroCusto ?? "—"}, conta ${l.reduzido}) ${deltas[k] > 0 ? "+" : ""}${deltas[k]}`).join("; ")}`);

try {
  // --- 1. Competência fechada --------------------------------------------
  console.log(`\n1. Reimportar o balancete alterado em ${am(mes)}, fechada`);
  const s0 = (await api.get(`/competencias/${am(mes)}/apuracao`)).body.data;
  if (!s0.apurada || s0.mudancas.length) await api.post(`/competencias/${am(mes)}/apuracao/apurar`);
  const f = await api.post(`/competencias/${am(mes)}/apuracao/fechar`);
  ok(f.status === 200, `${am(mes)} fechada`);
  const antes = await retrato(am(mes));
  const imp = await importar(am(mes), alterado);
  ok(imp.status === "CONCLUIDA" && imp.comparacao === true && imp.resumo?.modo === "COMPARACAO", `a importação foi aceita só para comparar (${imp.status}, ${imp.resumo?.divergencias} divergência(s))`);
  const lista1 = (await api.get(`/divergencias?competencia=${am(mes)}&status=ABERTA`)).body.data;
  const daImport = lista1.itens.filter((d: { descricao: string }) => alvos.some((l) => d.descricao.includes(`conta ${l.reduzido}`) && d.descricao.includes(`Filial ${l.filial}`)));
  ok(daImport.length === alvos.length, `${daImport.length} divergência(s) registradas, uma por linha alterada`);
  for (const [k, l] of alvos.entries()) {
    const d = daImport.find((x: { descricao: string }) => x.descricao.includes(`conta ${l.reduzido}`) && x.descricao.includes(`Filial ${l.filial}`));
    ok(
      !!d && Math.abs(Number(d.diferenca) - deltas[k]) < 0.01 && Math.abs(Number(d.valorRecebido) - Number(d.valorGravado) - deltas[k]) < 0.01,
      `  ${d?.descricao}: gravado ${d?.valorGravado}, recebido ${d?.valorRecebido}, diferença ${d?.diferenca}`,
    );
  }
  const depois = await retrato(am(mes));
  ok(JSON.stringify(antes) === JSON.stringify(depois), "a competência não mudou: lançamentos, estado e DRE apurada iguais");

  // --- 2. Mês aberto compara os fechados ----------------------------------
  console.log(`\n2. Importar o mesmo arquivo em ${am(mes + 1)}, aberta`);
  const imp2 = await importar(am(mes + 1), alterado);
  const retro = (imp2.resumo?.retroativas ?? []) as Array<{ competencia: string; divergencias: number }>;
  const doMes = retro.find((r) => r.competencia === `${String(mes).padStart(2, "0")}/${ano}`);
  ok(imp2.status === "CONCLUIDA" && !!doMes, `os meses fechados do arquivo foram comparados (${retro.map((r) => `${r.competencia}: ${r.divergencias} nova(s)`).join(", ")})`);
  ok(doMes?.divergencias === 0, "as diferenças já registradas não se repetem");

  // --- 3. Aviso, recorte, justificar, resolver ----------------------------
  console.log("\n3. Aviso ao entrar, recorte e tratamento");
  const me = (await api.get("/auth/me")).body.data;
  ok(me.divergenciasAbertas >= alvos.length, `ao entrar, o Contábil é avisado: ${me.divergenciasAbertas} divergência(s) aberta(s)`);
  const gestao = await prisma.perfil.findUniqueOrThrow({ where: { codigo: "GESTAO" } });
  await prisma.usuario.deleteMany({ where: { email: "gestor.div@bpm.com.br" } });
  await api.post("/usuarios", { nome: "Gestor Div", email: "gestor.div@bpm.com.br", senha: "senha-de-teste-1", perfilId: gestao.id, departamentos: [] });
  const g = (await login("gestor.div@bpm.com.br", "senha-de-teste-1")).token;
  const vistasG = (await api.get("/divergencias", g)).body.data;
  ok(vistasG.total === 0 && (await api.get("/auth/me", g)).body.data.divergenciasAbertas === 0, "o Gestor sem departamento não vê divergência");
  ok((await api.post("/divergencias/justificar", { ids: [daImport[0].id], justificativa: "Tentativa do gestor de justificar." }, g)).status === 403, "o Gestor não justifica (só lê)");
  await prisma.usuario.deleteMany({ where: { email: "gestor.div@bpm.com.br" } });

  const j = await api.post("/divergencias/justificar", { ids: [daImport[0].id], justificativa: "Lançamento reclassificado pelo RM depois do fechamento; sem efeito na DRE." });
  ok(j.status === 200 && j.body.data.justificadas === 1, "uma divergência justificada");
  const curto = await api.post("/divergencias/resolver", { competencia: am(mes), justificativa: "curta" });
  ok(curto.status === 400, "resolver exige justificativa");
  const res = await api.post("/divergencias/resolver", { competencia: am(mes), justificativa: "Conferência do Passo 24: o RM alterou o balancete depois do fechamento." });
  ok(res.status === 200 && res.body.data.situacao.competencia.status === "ABERTA", `resolver reabre a competência (${res.body.data.resolvidas} divergência(s) resolvidas)`);
  const lista2 = (await api.get(`/divergencias?competencia=${am(mes)}`)).body.data.itens as Array<{ id: string; status: string; tratadaPor: string; justificativa: string }>;
  const tratadas = lista2.filter((d) => daImport.some((x: { id: string }) => x.id === d.id));
  ok(tratadas.some((d) => d.status === "JUSTIFICADA") && tratadas.some((d) => d.status === "RESOLVIDA_POR_REABERTURA") && tratadas.every((d) => d.tratadaPor === "Administrador BPM"), "estados JUSTIFICADA e RESOLVIDA_POR_REABERTURA, com autor e justificativa");
  const log = (await api.get("/auditoria?entidade=divergencia&porPagina=20")).body.data.itens as Array<{ acao: string }>;
  ok(log.some((r) => r.acao === "JUSTIFICATIVA") && log.some((r) => r.acao === "RESOLUCAO"), "justificativa e resolução ficaram no log de auditoria");

  // --- 4. Preço de contrato -------------------------------------------------
  console.log("\n4. Preço de contrato substituído depois da apuração");
  await api.post(`/competencias/${am(mes)}/apuracao/apurar`);
  // Um preço que ainda não tem divergência: a detecção não repete a do mesmo
  // preço substituído, e a conferência tem de poder ser repetida.
  const jaTem = (await prisma.divergencia.findMany({ where: { precoContratoId: { not: null } }, select: { precoContratoId: true } })).map((d) => d.precoContratoId!);
  const item = await prisma.receitaPreviaItem.findFirstOrThrow({
    where: { precoBrutoId: { not: null, notIn: jaTem }, quantidade: { gt: 0 }, receitaPrevia: { competencia: { ano, mes } } },
    select: { precoBrutoId: true, precoBruto: true, obraCodigo: true },
  });
  const preco = await prisma.precoContrato.findUniqueOrThrow({ where: { id: item.precoBrutoId! }, select: { valorUnitario: true } });
  const novo = preco.valorUnitario!.plus(100);
  const det = await detectarPrecos(imp.id, [{ anteriorId: item.precoBrutoId!, valorAnterior: preco.valorUnitario, valorNovo: novo }]);
  const dp = (await api.get(`/divergencias?competencia=${am(mes)}&tipo=PRECO_CONTRATO&status=ABERTA`)).body.data.itens as Array<{ descricao: string; diferenca: string; impacto: string }>;
  ok(det.some((d) => d.competencia === `${String(mes).padStart(2, "0")}/${ano}`) && dp.length > 0 && Number(dp[0].diferenca) === 100, `divergência de preço: ${dp[0]?.descricao}, diferença ${dp[0]?.diferenca}, efeito na receita ${dp[0]?.impacto}`);
  await api.post(`/competencias/${am(mes)}/apuracao/apurar`);
  const dp2 = (await api.get(`/divergencias?competencia=${am(mes)}&tipo=PRECO_CONTRATO`)).body.data.itens as Array<{ status: string }>;
  ok(dp2.length > 0 && dp2.every((d) => d.status === "RESOLVIDA_POR_REAPURACAO"), "a reapuração da competência aberta resolve a divergência de preço");
} finally {
  // Arrumação: as duas competências voltam a ficar apuradas.
  for (const m of [mes, mes + 1]) {
    const s = (await api.get(`/competencias/${am(m)}/apuracao`)).body.data;
    if (s.competencia.status === "FECHADA") {
      await api.post("/divergencias/resolver", { competencia: am(m), justificativa: "Arrumação da conferência do Passo 24." });
      if ((await api.get(`/competencias/${am(m)}/apuracao`)).body.data.competencia.status === "FECHADA") {
        await api.post(`/competencias/${am(m)}/apuracao/reabrir`, { justificativa: "Arrumação da conferência do Passo 24." });
      }
    }
    await api.post(`/competencias/${am(m)}/apuracao/apurar`);
  }
}
console.log(falhas === 0 ? "\nA detecção de divergências confere." : `\n${falhas} verificação(ões) falharam.`);
await prisma.$disconnect();
process.exit(falhas ? 1 : 0);
