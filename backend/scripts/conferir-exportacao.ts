/**
 * Conferência da exportação da DRE (Passo 26), pela API:
 * - o Excel e o PDF de cada visão (consolidado, as unidades, todas e um
 *   agrupamento de centros) trazem as mesmas linhas, na mesma ordem e com os
 *   mesmos valores da consulta da tela;
 * - os arquivos identificam a competência, o estado, a apuração e a geração;
 * - o recorte: o Gestor exporta a DRE inteira, mas os centros só dos seus
 *   departamentos; o Alimentador não exporta; competência não apurada não
 *   exporta;
 * - a exportação vai para o log de auditoria.
 * Os usuários de teste são apagados no fim.
 *
 * Uso: npx tsx scripts/conferir-exportacao.ts 2026 8
 */
import "dotenv/config";
import type { Response as RespostaHttp } from "superagent";
import request from "supertest";
import { strFromU8, unzipSync } from "fflate";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";
import { lerAba, listarAbas } from "../src/lib/xlsx.js";

const [anoTexto = "2026", mesTexto = "8"] = process.argv.slice(2);
const ano = Number(anoTexto);
const mes = Number(mesTexto);
const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;
const rotulo = `${String(mes).padStart(2, "0")}/${ano}`;
const prisma = getPrismaClient();
const SENHA = "senha-de-teste-1";
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};

type Linha = { tipo: string; grupo: string; descricao: string; valor: string | null };

async function login(email: string, senha = SENHA) {
  const r = await request(app).post("/auth/login").send({ email, password: senha });
  return r.status === 200 ? (r.body.data.token as string) : null;
}
const json = (t: string, url: string) => request(app).get(url).set("Authorization", `Bearer ${t}`);
/** O arquivo como Buffer (o supertest só entende texto e JSON). */
const binario = (res: RespostaHttp, cb: (e: Error | null, b: Buffer) => void) => {
  const partes: Buffer[] = [];
  res.on("data", (c: Buffer) => partes.push(Buffer.from(c)));
  res.on("end", () => cb(null, Buffer.concat(partes)));
};
const exportar = (t: string, params: Record<string, string>) =>
  request(app).get(`/competencias/${anoMes}/dre/exportar`).query(params).set("Authorization", `Bearer ${t}`).buffer(true).parse(binario as never);

// --- O que a tela mostra ------------------------------------------------------
const VOLUME = new Set(["PRODUÇÃO (P)", "SERVIÇOS (S)"]);
// Os formatos da tela: moeda() de utils/formatacao.ts e volume() de DREContent.tsx.
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const volume = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const naTela = (l: Linha) => (l.valor === null ? "—" : VOLUME.has(l.grupo) ? volume.format(Number(l.valor)) : moeda.format(Number(l.valor)));
const visiveis = (ls: Linha[]) => ls.filter((l) => l.tipo !== "SECAO");

// --- Leitura dos arquivos -----------------------------------------------------
/** As linhas da tabela de uma aba do Excel exportado: as que vêm depois do cabeçalho "Linha | Valor". */
function tabelaDoExcel(buffer: Uint8Array, aba: string) {
  const linhas = lerAba(buffer, () => aba).linhas;
  const i = linhas.findIndex((l) => l.celulas[0] === "Linha" && l.celulas[1] === "Valor");
  return { topo: linhas.slice(0, Math.max(i, 0)).map((l) => String(l.celulas[0] ?? "")), corpo: linhas.slice(i + 1).map((l) => l.celulas) };
}

const WINANSI: Record<number, string> = { 0x80: "€", 0x85: "…", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—" };
/** Os textos de cada página do PDF, na ordem em que são desenhados. */
function textosDoPdf(buffer: Uint8Array) {
  const pdf = strFromU8(buffer, true);
  const paginas: string[][] = [];
  for (const m of pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const textos: string[] = [];
    for (const t of m[1].matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)) {
      textos.push(
        t[1].replace(/\\([0-7]{3}|.)/g, (_, e: string) => {
          if (e.length === 1) return e;
          const c = parseInt(e, 8);
          return WINANSI[c] ?? String.fromCharCode(c);
        }),
      );
    }
    paginas.push(textos);
  }
  return paginas;
}
/**
 * As linhas da DRE de cada página: o que vem depois do cabeçalho da tabela
 * ("Valor"), menos o rodapé, que é desenhado por último (geração e página).
 */
const corpoDoPdf = (paginas: string[][]) => paginas.flatMap((p) => p.slice(p.indexOf("Valor") + 1, -2));

/**
 * Os estilos das células da tabela, lidos do XML da aba: o da descrição e o do
 * valor de cada linha, na ordem. Ver ESTILO em src/lib/xlsxEscrita.ts.
 */
function estilosDoExcel(buffer: Uint8Array, aba: string) {
  const pacote = unzipSync(buffer);
  const indice = listarAbas(buffer).indexOf(aba) + 1;
  const xml = strFromU8(pacote[`xl/worksheets/sheet${indice}.xml`]);
  const linhas = [...xml.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)].map((m) => [...m[2].matchAll(/<c r="[A-Z]+\d+"(?: s="(\d+)")?/g)].map((c) => Number(c[1] ?? 0)));
  const i = linhas.findIndex((l) => l[0] === 3); // o cabeçalho "Linha | Valor"
  return { linhas: linhas.slice(i + 1), moeda: strFromU8(pacote["xl/styles.xml"]).match(/numFmtId="164" formatCode="([^"]+)"/)?.[1].replace(/&quot;/g, '"') };
}

function conferirExcel(buffer: Uint8Array, aba: string, linhas: Linha[], titulo: string, estado: string) {
  const { topo, corpo } = tabelaDoExcel(buffer, aba);
  const esperadas = visiveis(linhas);
  // Total em negrito com fundo (7), item recuado (4); valor em moeda (5/8), volume (6/9) ou "—" (10/11).
  const estilos = estilosDoExcel(buffer, aba);
  const forma = esperadas.filter((l, i) => {
    const [d, v] = estilos.linhas[i] ?? [];
    const destaque = l.tipo !== "ITEM";
    const valor = l.valor === null ? (destaque ? 11 : 10) : VOLUME.has(l.grupo) ? (destaque ? 9 : 6) : destaque ? 8 : 5;
    return d !== (destaque ? 7 : 4) || v !== valor;
  });
  ok(forma.length === 0 && estilos.moeda === '"R$ "#,##0.00;-"R$ "#,##0.00', `Excel, aba ${aba}: totais em destaque, itens recuados, moeda em R$ e volumes à parte${forma.length ? ` (diferem: ${forma.slice(0, 3).map((d) => d.descricao).join("; ")})` : ""}`);
  const diferencas = esperadas.filter((l, i) => {
    const c = corpo[i] ?? [];
    const valor = l.valor === null ? "—" : Number(l.valor);
    return c[0] !== l.descricao || c[1] !== valor;
  });
  ok(corpo.length === esperadas.length && diferencas.length === 0, `Excel, aba ${aba}: ${esperadas.length} linhas iguais às da tela${diferencas.length ? ` (diferem: ${diferencas.slice(0, 3).map((d) => d.descricao).join("; ")})` : corpo.length !== esperadas.length ? ` (o arquivo tem ${corpo.length})` : ""}`);
  ok(topo[0] === `DRE · ${rotulo} · ${titulo}` && topo[1]?.startsWith(`Competência ${rotulo} · ${estado} · apurada em `) && /^Gerado em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por /.test(topo[2] ?? ""), `Excel, aba ${aba}: identifica a competência, o estado (${estado}), a apuração e a geração`);
}

function conferirPdf(buffer: Uint8Array, blocos: Array<{ titulo: string; linhas: Linha[] }>, estado: string) {
  const paginas = textosDoPdf(buffer);
  const todos = paginas.flat();
  const corpo = corpoDoPdf(paginas);
  const esperado = blocos.flatMap((b) => visiveis(b.linhas).flatMap((l) => [l.descricao, naTela(l)]));
  const primeiraDiferenca = esperado.findIndex((t, i) => corpo[i] !== t);
  ok(corpo.length === esperado.length && primeiraDiferenca === -1, `PDF (${blocos.map((b) => b.titulo).join(", ")}): ${esperado.length / 2} linhas com descrição e valor iguais aos da tela${primeiraDiferenca >= 0 ? ` (primeira diferença: "${corpo[primeiraDiferenca]}" no lugar de "${esperado[primeiraDiferenca]}")` : corpo.length !== esperado.length ? ` (o arquivo tem ${corpo.length / 2})` : ""}`);
  const n = paginas.length;
  ok(paginas.every((p, i) => p.includes(`Página ${i + 1} de ${n}`) && p.some((t) => /^Gerado em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} por /.test(t))), `PDF: ${n} página(s), todas com "Página x de ${n}" e a data de geração`);
  ok(blocos.every((b) => todos.includes(`DRE · ${rotulo} · ${b.titulo}`)) && todos.some((t) => t.startsWith(`Competência ${rotulo} · ${estado} · apurada em `)), `PDF: identifica a competência, o estado (${estado}) e a apuração`);
}

// --- Conferência ------------------------------------------------------------
const admin = (await login("admin@bpm.com", "admin123"))!;
const competencia = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } } });
if (!competencia.apuradaEm) throw new Error(`${anoMes} precisa estar apurada para a conferência.`);
const estado = { ABERTA: "Aberta", EM_CONFERENCIA: "Em conferência", FECHADA: "Fechada" }[competencia.status];
const unidades = await prisma.unidadeNegocio.findMany({ where: { ativo: true }, orderBy: { ordem: "asc" } });
const inicio = new Date();

console.log(`\nVisões de ${rotulo} (${estado})`);
const consolidado = (await json(admin, `/competencias/${anoMes}/dre/consolidado`)).body.data.linhas as Linha[];
const porUnidade = new Map<number, Linha[]>();
for (const u of unidades) porUnidade.set(u.codigo, (await json(admin, `/competencias/${anoMes}/dre?unidade=${u.codigo}`)).body.data.linhas);

const xC = await exportar(admin, { formato: "xlsx", visao: "consolidado" });
ok(xC.status === 200 && String(xC.headers["content-type"]).includes("spreadsheetml"), `Excel do consolidado: ${xC.status}, ${xC.headers["content-type"]}`);
ok(/filename\*=UTF-8''DRE%202026-08%20-%20Consolidado\.xlsx/.test(String(xC.headers["content-disposition"])), `nome do arquivo: ${decodeURIComponent(String(xC.headers["content-disposition"]).split("''")[1] ?? "")}`);
conferirExcel(xC.body, "Consolidado", consolidado, "Consolidado", estado);

for (const u of unidades) {
  const x = await exportar(admin, { formato: "xlsx", visao: String(u.codigo) });
  conferirExcel(x.body, u.nome, porUnidade.get(u.codigo)!, u.nome, estado);
}
const xT = await exportar(admin, { formato: "xlsx", visao: "todas" });
const abas = listarAbas(xT.body);
ok(abas.join("|") === ["Consolidado", ...unidades.map((u) => u.nome)].join("|"), `Excel de todas as visões: abas ${abas.join(", ")}`);
conferirExcel(xT.body, "Serviços", porUnidade.get(3)!, "Serviços", estado);

const pC = await exportar(admin, { formato: "pdf", visao: "consolidado" });
ok(pC.status === 200 && pC.headers["content-type"] === "application/pdf" && strFromU8(pC.body.subarray(0, 8)) === "%PDF-1.4", "PDF do consolidado: 200, application/pdf");
conferirPdf(pC.body, [{ titulo: "Consolidado", linhas: consolidado }], estado);
const pT = await exportar(admin, { formato: "pdf", visao: "todas" });
conferirPdf(pT.body, [{ titulo: "Consolidado", linhas: consolidado }, ...unidades.map((u) => ({ titulo: u.nome, linhas: porUnidade.get(u.codigo)! }))], estado);

// Um agrupamento de centros com mais de um centro.
const grupos = (await json(admin, `/competencias/${anoMes}/dre/centros`)).body.data.grupos as Array<{ grupo: string; centros: number }>;
const grupo = grupos.find((g) => g.centros > 1) ?? grupos[0];
const doGrupo = (await json(admin, `/competencias/${anoMes}/dre/centros`).query({ grupo: grupo.grupo })).body.data;
const xG = await exportar(admin, { formato: "xlsx", grupo: grupo.grupo });
conferirExcel(xG.body, listarAbas(xG.body)[0], doGrupo.linhas, `Centro de custo: ${grupo.grupo}`, estado);
const pG = await exportar(admin, { formato: "pdf", grupo: grupo.grupo });
const textosG = textosDoPdf(pG.body).flat();
const listaCentros = (doGrupo.centros as Array<{ codigoRM: string | null; nome: string }>).map((c) => `${c.codigoRM ?? "sem código"} · ${c.nome}`).join("  |  ");
ok(textosG.some((t) => t === listaCentros || (t.endsWith("…") && listaCentros.startsWith(t.slice(0, -1)))), `PDF do centro de custo ${grupo.grupo}: lista os ${grupo.centros} centros do agrupamento`);
conferirPdf(pG.body, [{ titulo: `Centro de custo: ${grupo.grupo}`, linhas: doGrupo.linhas }], estado);

// --- Recusas -----------------------------------------------------------------
console.log("\nRecusas");
ok((await exportar(admin, { formato: "docx", visao: "consolidado" })).status === 400, "formato desconhecido: 400");
ok((await exportar(admin, { formato: "pdf", visao: "9" })).status === 400, "visão inválida: 400");
const naoApurada = await prisma.competencia.findFirst({ where: { apuradaEm: null }, orderBy: [{ ano: "desc" }, { mes: "desc" }] });
if (naoApurada) {
  const am = `${naoApurada.ano}-${String(naoApurada.mes).padStart(2, "0")}`;
  const r = await request(app).get(`/competencias/${am}/dre/exportar`).query({ formato: "xlsx" }).set("Authorization", `Bearer ${admin}`);
  ok(r.status === 409, `competência não apurada (${am}): ${r.status} ${r.body.error ?? ""}`);
}

// --- Recorte -------------------------------------------------------------------
console.log("\nRecorte");
const opcoes = (await json(admin, "/usuarios/opcoes")).body.data;
const perfil = (codigo: string) => opcoes.perfis.find((p: { codigo: string }) => p.codigo === codigo).id as string;
const criados: string[] = [];
async function criarUsuario(email: string, perfilId: string, setores: string[] = [], departamentos: string[] = []) {
  await prisma.usuario.deleteMany({ where: { email } });
  const r = await request(app).post("/usuarios").set("Authorization", `Bearer ${admin}`).send({ nome: `Teste ${email.split("@")[0]}`, email, senha: SENHA, perfilId, setores, departamentos });
  if (r.status !== 201) throw new Error(`criar ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  criados.push(r.body.data.id);
}
try {
  await criarUsuario("gestor.exporta@bpm.com.br", perfil("GESTAO"), [], ["PRODUCAO", "TECNICO"]);
  const g = (await login("gestor.exporta@bpm.com.br"))!;
  const gC = await exportar(g, { formato: "xlsx", visao: "consolidado" });
  ok(gC.status === 200, "o Gestor exporta a DRE consolidada");
  conferirExcel(gC.body, "Consolidado", consolidado, "Consolidado", estado);
  const gGrupos = (await json(g, `/competencias/${anoMes}/dre/centros`)).body.data.grupos as Array<{ grupo: string }>;
  const seu = gGrupos[0]?.grupo;
  if (seu) {
    const dele = (await json(g, `/competencias/${anoMes}/dre/centros`).query({ grupo: seu })).body.data;
    const todosDoGrupo = (await json(admin, `/competencias/${anoMes}/dre/centros`).query({ grupo: seu })).body.data;
    const gx = await exportar(g, { formato: "xlsx", grupo: seu });
    conferirExcel(gx.body, listarAbas(gx.body)[0], dele.linhas, `Centro de custo: ${seu}`, estado);
    ok(visiveis(dele.linhas).length <= visiveis(todosDoGrupo.linhas).length, `no centro ${seu}, só as linhas dos departamentos dele (${visiveis(dele.linhas).length} de ${visiveis(todosDoGrupo.linhas).length})`);
  }
  const alheio = grupos.find((x) => !gGrupos.some((y) => y.grupo === x.grupo));
  if (alheio) ok((await exportar(g, { formato: "pdf", grupo: alheio.grupo })).status === 404, `não exporta um centro fora dos seus departamentos (${alheio.grupo}): 404`);

  await criarUsuario("gestor.semdep.exporta@bpm.com.br", perfil("GESTAO"));
  const s = (await login("gestor.semdep.exporta@bpm.com.br"))!;
  ok((await exportar(s, { formato: "pdf", visao: "todas" })).status === 200, "o Gestor sem departamento exporta a DRE das unidades");
  ok((await exportar(s, { formato: "xlsx", grupo: grupo.grupo })).status === 404, "mas nenhum centro de custo: 404");

  await criarUsuario("alimentador.exporta@bpm.com.br", perfil("ALIMENTADOR"), ["PRODUCAO"]);
  const a = (await login("alimentador.exporta@bpm.com.br"))!;
  ok((await exportar(a, { formato: "xlsx", visao: "consolidado" })).status === 403, "o Alimentador não exporta: 403");
} finally {
  for (const id of criados) await prisma.usuario.delete({ where: { id } }).catch(() => undefined);
}

// --- Auditoria ---------------------------------------------------------------
console.log("\nAuditoria");
const logs = await prisma.auditLog.findMany({ where: { acao: "EXPORTACAO", createdAt: { gte: inicio } }, orderBy: { createdAt: "asc" } });
const meta = (l: (typeof logs)[number]) => l.metadados as { formato?: string; visoes?: string[]; arquivo?: string };
ok(logs.length >= 12, `${logs.length} exportações registradas no log`);
ok(logs.some((l) => meta(l).formato === "pdf" && meta(l).visoes?.length === unidades.length + 1 && l.entidadeId === anoMes), "o registro guarda a competência, o formato e as visões exportadas");
ok(logs.some((l) => l.usuarioNome?.startsWith("Teste gestor.exporta")), "e quem exportou");
ok(!logs.some((l) => /docx/.test(JSON.stringify(l.metadados))), "a exportação recusada não é registrada");

console.log(falhas === 0 ? "\nTudo confere." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
