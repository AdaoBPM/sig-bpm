/**
 * Conferência da edição dos cadastros (Passo 25), pela API:
 * - o Contábil corrige o destino de uma conta na DRE: a competência apurada
 *   não muda; depois de reapurada, o valor passa de uma linha para a outra;
 * - a alteração vai para o log de auditoria, com o antes e o depois;
 * - o Gestor não edita cadastros;
 * - um centro com lançamentos não é excluído;
 * - a expressão da DRE é validada (referência inexistente, ciclo);
 * - com a competência fechada, a linha com valor apurado não é inativada.
 * No fim a conta volta ao destino original e a competência é reapurada (e
 * reaberta, se tiver sido fechada aqui).
 *
 * Uso: npx tsx scripts/conferir-cadastros.ts 2026 8
 */
import "dotenv/config";
import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";

const [anoTexto = "2026", mesTexto = "8"] = process.argv.slice(2);
const ano = Number(anoTexto);
const mes = Number(mesTexto);
const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;
const prisma = getPrismaClient();
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};
const moeda = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function login(email: string, senha: string) {
  const r = await request(app).post("/auth/login").send({ email, password: senha });
  return r.status === 200 ? (r.body.data.token as string) : null;
}
const admin = (await login("admin@bpm.com", "admin123"))!;
const com = (t: string) => ({
  get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${t}`),
  post: (url: string, body?: object) => request(app).post(url).set("Authorization", `Bearer ${t}`).send(body ?? {}),
  put: (url: string, body: object) => request(app).put(url).set("Authorization", `Bearer ${t}`).send(body),
  del: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${t}`),
});
const a = com(admin);

async function dreConsolidada() {
  const r = await a.get(`/competencias/${anoMes}/dre/consolidado`);
  return new Map((r.body.data.linhas as Array<{ codigo: string; valor: string | null }>).map((l) => [l.codigo, Number(l.valor ?? 0)]));
}
const apurar = async () => {
  const r = await a.post(`/competencias/${anoMes}/apuracao/apurar`);
  if (r.status !== 200) throw new Error(`apurar: ${r.status} ${JSON.stringify(r.body)}`);
};

const competencia = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } } });
if (!competencia.apuradaEm) throw new Error(`${anoMes} precisa estar apurada para a conferência.`);
if (competencia.status === "FECHADA") throw new Error(`${anoMes} está fechada; reabra antes de conferir.`);

// --- A conta e as duas linhas ----------------------------------------------
// Uma conta de custo de produção com movimento no mês, sem reclassificação
// (para o valor dela ir inteiro para a linha), e outra linha do mesmo grupo,
// atribuição e unidades, para onde o Contábil a "corrige".
const reclassificadas = new Set(
  (await prisma.reclassificacaoConta.findMany({ select: { contaOrigemId: true, contaDestinoId: true } })).flatMap((r) => [r.contaOrigemId, r.contaDestinoId]),
);
const linhas = await prisma.linhaDRE.findMany({ where: { tipo: "ITEM", ativo: true, grupo: "CUSTOS DE PRODUÇÃO (CP)" }, include: { unidades: { select: { unidadeNegocioId: true } } } });
const unidadesDe = (l: (typeof linhas)[number]) => l.unidades.map((u) => u.unidadeNegocioId).sort().join(",");
// Pela conta adotada, que é a que classifica (a do balancete pode ter sido
// reclassificada). A soma é feita aqui: o groupBy do adaptador do SQLite trunca
// as somas para inteiro quando a primeira do resultado é inteira.
const somas = new Map<string, number>();
for (const l of await prisma.lancamentoContabil.findMany({
  where: { competenciaId: competencia.id, linhaDREId: { in: linhas.map((x) => x.id) }, contaAdotadaId: { not: null } },
  select: { contaAdotadaId: true, valorMovimento: true },
})) {
  somas.set(l.contaAdotadaId!, (somas.get(l.contaAdotadaId!) ?? 0) + Number(l.valorMovimento));
}
let escolha: { contaId: string; origem: (typeof linhas)[number]; destino: (typeof linhas)[number]; valor: number } | null = null;
for (const [contaAdotadaId, valor] of [...somas].sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))) {
  if (reclassificadas.has(contaAdotadaId)) continue;
  const conta = await prisma.contaResultado.findUniqueOrThrow({ where: { id: contaAdotadaId } });
  const origem = linhas.find((l) => l.id === conta.linhaDREId);
  if (!origem) continue;
  const destino = linhas.find((l) => l.id !== origem.id && l.atribuicao === origem.atribuicao && unidadesDe(l) === unidadesDe(origem));
  if (!destino) continue;
  escolha = { contaId: conta.id, origem, destino, valor };
  break;
}
if (!escolha) throw new Error("Nenhuma conta de CPP serve para a conferência.");
const { contaId, origem, destino } = escolha;
const conta = (await a.get(`/cadastros/edicao/contas-resultado/${contaId}`)).body.data;
console.log(`\nConta ${conta.reduzido} ${conta.descricao}: movimento de ${moeda(escolha.valor)} em ${anoMes}`);
console.log(`  de ${origem.codigo} (${origem.descricao}) para ${destino.codigo} (${destino.descricao})`);

let usuarioGestor: string | null = null;
let fechadaAqui = false;
let corrigida = false;
try {
  // --- O Contábil corrige a conta e reapura ---------------------------------
  console.log("\nO Contábil corrige a conta e reapura");
  const antes = await dreConsolidada();
  const inicioLog = new Date();
  const put = await a.put(`/cadastros/edicao/contas-resultado/${contaId}`, { ...conta, linhaDREId: destino.id });
  corrigida = put.status === 200;
  ok(put.status === 200, `a correção é gravada (${put.status}${put.status !== 200 ? ` ${put.body.error}` : ""})`);
  const efeito = put.body.data ?? {};
  ok((efeito.apuradasPorReapurar ?? []).includes(`${String(mes).padStart(2, "0")}/${ano}`), `a resposta avisa que ${anoMes} está apurada e precisa ser reapurada (${(efeito.apuradasPorReapurar ?? []).join(", ")})`);
  console.log(`    reclassificadas na hora: ${(efeito.reclassificadas ?? []).join(", ") || "nenhuma"}`);
  const congelada = await dreConsolidada();
  ok(congelada.get(origem.codigo) === antes.get(origem.codigo) && congelada.get(destino.codigo) === antes.get(destino.codigo), "a DRE apurada não muda antes da reapuração");

  await apurar();
  const depois = await dreConsolidada();
  const saiu = antes.get(origem.codigo)! - depois.get(origem.codigo)!;
  const entrou = depois.get(destino.codigo)! - antes.get(destino.codigo)!;
  console.log(`    ${origem.codigo}: ${moeda(antes.get(origem.codigo)!)} → ${moeda(depois.get(origem.codigo)!)}`);
  console.log(`    ${destino.codigo}: ${moeda(antes.get(destino.codigo)!)} → ${moeda(depois.get(destino.codigo)!)}`);
  ok(Math.abs(saiu) > 0.005, `reapurada, a linha de origem muda (${moeda(saiu)})`);
  ok(Math.abs(saiu - entrou) < 0.01, "o que sai de uma linha entra na outra");
  const demais = [...antes.keys()].filter((c) => c !== origem.codigo && c !== destino.codigo && !c.startsWith("CPP") && Math.abs(antes.get(c)! - depois.get(c)!) > 0.01);
  ok(demais.length === 0, `fora do CPP, nenhuma linha muda${demais.length ? ` (mudaram: ${demais.slice(0, 5).join(", ")})` : ""}`);

  const log = await prisma.auditLog.findFirst({ where: { entidade: "conta_resultado", entidadeId: contaId, acao: "ALTERACAO", createdAt: { gte: inicioLog } }, orderBy: { createdAt: "desc" } });
  const da = log?.dadosAntes as { linhaDREId?: string } | null;
  const dd = log?.dadosDepois as { linhaDREId?: string } | null;
  ok(!!log && da?.linhaDREId === origem.id && dd?.linhaDREId === destino.id, "o log de auditoria guarda o antes e o depois do destino na DRE");
  ok(log?.usuarioId === "00000000-0000-0000-0000-000000000001", "e quem alterou");

  // --- O Gestor não edita -----------------------------------------------------
  console.log("\nGestor");
  const perfilGestao = await prisma.perfil.findUniqueOrThrow({ where: { codigo: "GESTAO" } });
  await prisma.usuario.deleteMany({ where: { email: "gestor.cadastros@bpm.com.br" } });
  const novo = await a.post("/usuarios", { nome: "Teste gestor cadastros", email: "gestor.cadastros@bpm.com.br", senha: "senha-de-teste-1", perfilId: perfilGestao.id, departamentos: ["PRODUCAO"] });
  usuarioGestor = novo.body.data.id;
  const g = com((await login("gestor.cadastros@bpm.com.br", "senha-de-teste-1"))!);
  const gPut = await g.put(`/cadastros/edicao/contas-resultado/${contaId}`, { ...conta });
  ok(gPut.status === 403, `não grava a conta (${gPut.status})`);
  ok((await g.del(`/cadastros/edicao/tipos-movimento/qualquer`)).status === 403, "não exclui");

  // --- Regras de exclusão e de expressão -------------------------------------
  console.log("\nRegras");
  const centroUsado = await prisma.lancamentoContabil.findFirstOrThrow({ where: { competenciaId: competencia.id, centroCustoId: { not: null } }, select: { centroCustoId: true } });
  const del = await a.del(`/cadastros/edicao/centros-custo/${centroUsado.centroCustoId}`);
  ok(del.status === 409, `um centro com lançamentos não é excluído (${del.status}: ${del.body.error})`);
  ok(!!(await prisma.centroCusto.findUnique({ where: { id: centroUsado.centroCustoId! } })), "e continua no cadastro");

  const subtotal = await prisma.linhaDRE.findFirstOrThrow({ where: { tipo: "SUBTOTAL", ativo: true, expressao: { not: null } }, orderBy: { ordem: "asc" } });
  const reg = (await a.get(`/cadastros/edicao/estrutura-dre/${subtotal.id}`)).body.data;
  const inexistente = await a.put(`/cadastros/edicao/estrutura-dre/${subtotal.id}`, { ...reg, expressao: `${reg.expressao} + NAO.EXISTE` });
  ok(inexistente.status === 400, `expressão com linha inexistente é recusada (${inexistente.body.error})`);
  const ciclo = await a.put(`/cadastros/edicao/estrutura-dre/${subtotal.id}`, { ...reg, expressao: `${reg.expressao} + ${subtotal.codigo}` });
  ok(ciclo.status === 400, `expressão que cita a própria linha é recusada (${ciclo.body.error})`);
  const sintaxe = await a.put(`/cadastros/edicao/estrutura-dre/${subtotal.id}`, { ...reg, expressao: `${reg.expressao} +` });
  ok(sintaxe.status === 400, `expressão mal escrita é recusada (${sintaxe.body.error})`);
  ok((await prisma.linhaDRE.findUniqueOrThrow({ where: { id: subtotal.id } })).expressao === subtotal.expressao, "e a expressão gravada não muda");

  // --- Volta a conta e reapura -------------------------------------------------
  console.log("\nA conta volta ao destino original");
  const volta = await a.put(`/cadastros/edicao/contas-resultado/${contaId}`, { ...conta, linhaDREId: origem.id });
  ok(volta.status === 200, "a conta volta");
  corrigida = volta.status !== 200;
  await apurar();
  const final = await dreConsolidada();
  const diferentes = [...antes.keys()].filter((c) => Math.abs(antes.get(c)! - final.get(c)!) > 0.005);
  ok(diferentes.length === 0, `reapurada, a DRE é a de antes${diferentes.length ? ` (diferem: ${diferentes.slice(0, 5).join(", ")})` : ""}`);

  // --- Competência fechada ------------------------------------------------------
  console.log("\nCompetência fechada");
  const fechar = await a.post(`/competencias/${anoMes}/apuracao/fechar`);
  if (fechar.status !== 200) {
    console.log(`  (não foi possível fechar ${anoMes} para conferir: ${fechar.body.error})`);
  } else {
    fechadaAqui = true;
    // Uma linha com valor apurado que nenhuma expressão cita: a recusa é pela competência fechada.
    const expressoes = (await prisma.linhaDRE.findMany({ where: { ativo: true, expressao: { not: null } }, select: { expressao: true } })).map((l) => l.expressao!);
    const citada = (codigo: string) => expressoes.some((e) => e.split(/[^A-Za-z0-9_.]+/).includes(codigo));
    const apuradas = await prisma.resultadoApurado.findMany({ where: { competenciaId: competencia.id }, distinct: ["linhaDREId"], select: { linhaDRE: { select: { id: true, codigo: true, ativo: true } } } });
    const livre = apuradas.map((x) => x.linhaDRE).find((l) => l.ativo && !citada(l.codigo));
    if (!livre) console.log("  (nenhuma linha apurada fora das expressões para conferir a inativação)");
    else {
      const regLivre = (await a.get(`/cadastros/edicao/estrutura-dre/${livre.id}`)).body.data;
      const inativar = await a.put(`/cadastros/edicao/estrutura-dre/${livre.id}`, { ...regLivre, ativo: false });
      ok(inativar.status === 409 && /fechad/i.test(inativar.body.error ?? ""), `${livre.codigo}, apurada numa competência fechada, não é inativada (${inativar.body.error})`);
      ok((await prisma.linhaDRE.findUniqueOrThrow({ where: { id: livre.id } })).ativo, "e continua ativa");
    }
    const editar = await a.put(`/cadastros/edicao/contas-resultado/${contaId}`, { ...conta });
    ok(editar.status === 200 && !(editar.body.data.apuradasPorReapurar as string[]).includes(`${String(mes).padStart(2, "0")}/${ano}`), "editar uma conta não toca a competência fechada");
  }
} finally {
  if (corrigida) {
    await a.put(`/cadastros/edicao/contas-resultado/${contaId}`, { ...conta, linhaDREId: origem.id });
    await apurar();
  }
  if (fechadaAqui) {
    const r = await a.post(`/competencias/${anoMes}/apuracao/reabrir`, { justificativa: "Reaberta pela conferência dos cadastros (Passo 25)." });
    // A reabertura volta a competência a ABERTA; reapurada, ela fica em conferência como estava.
    await apurar();
    console.log(`\n(${anoMes} reaberta e reapurada: ${r.status})`);
  }
  if (usuarioGestor) await prisma.usuario.delete({ where: { id: usuarioGestor } }).catch(() => undefined);
}

console.log(falhas === 0 ? "\nTudo confere." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
