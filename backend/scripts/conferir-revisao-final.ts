/**
 * Conferência das correções da revisão final (Passo 28), pela API:
 * - recarga: um centro que saiu da planilha mas tem lançamento fica, inativado
 *   (antes era apagado, e os lançamentos e valores apurados perdiam o centro);
 * - retrato da apuração: editar um registro digitado de lista sem mudar a
 *   quantidade (a pista de alveolares para estacas) acusa mudança;
 * - trava: fechar enquanto a competência é apurada é recusado;
 * - perfis e usuários: recorte por departamento com leitura da classificação
 *   é recusado; setor que não é lista é recusado;
 * - acesso: a situação da apuração é do Contábil e do Gestor, não do Alimentador;
 * - login: o limite conta por e-mail e só as tentativas recusadas;
 * - entradas inválidas viram 4xx (tela longa, JSON malformado, cadastro
 *   "constructor"), e a auditoria das listas guarda o registro inteiro;
 * - saldo inicial do estoque não entra em competência com saldo apurado.
 * No fim, o que foi criado é apagado e a competência é reapurada.
 *
 * Uso: npx tsx scripts/conferir-revisao-final.ts "<UNIDADES E CENTROS DE CUSTO.xlsx>" "<LISTAS REALIZADO (OPERAÇÃO).xlsx>" 2026 8
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";
import { apuracaoService } from "../src/services/apuracao/apuracaoService.js";
import { recargaCadastrosService } from "../src/services/cadastros/recargaCadastrosService.js";

const [unidadesXlsx, listasXlsx, anoTexto = "2026", mesTexto = "8"] = process.argv.slice(2);
if (!unidadesXlsx || !listasXlsx) {
  console.error('Uso: npx tsx scripts/conferir-revisao-final.ts "<UNIDADES E CENTROS DE CUSTO.xlsx>" "<LISTAS REALIZADO (OPERAÇÃO).xlsx>" 2026 8');
  process.exit(1);
}
const ano = Number(anoTexto);
const mes = Number(mesTexto);
const anoMes = `${ano}-${String(mes).padStart(2, "0")}`;
const ADMIN = "00000000-0000-0000-0000-000000000001";
const SENHA = "senha-de-teste-1";
const prisma = getPrismaClient();
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};
async function login(email: string, senha = SENHA) {
  const r = await request(app).post("/auth/login").send({ email, password: senha });
  return r.status === 200 ? (r.body.data.token as string) : null;
}
const admin = (await login("admin@bpm.com", "admin123"))!;
const com = (t: string) => ({
  get: (u: string) => request(app).get(u).set("Authorization", `Bearer ${t}`),
  post: (u: string, b?: object) => request(app).post(u).set("Authorization", `Bearer ${t}`).send(b ?? {}),
  put: (u: string, b: object) => request(app).put(u).set("Authorization", `Bearer ${t}`).send(b),
  del: (u: string) => request(app).delete(u).set("Authorization", `Bearer ${t}`),
});
const a = com(admin);
const competencia = await prisma.competencia.findUniqueOrThrow({ where: { ano_mes: { ano, mes } } });
if (competencia.status === "FECHADA" || !competencia.apuradaEm) throw new Error(`${anoMes} precisa estar apurada e não fechada.`);

const criados = { centro: null as string | null, lancamento: null as string | null, pista: null as string | null, usuarios: [] as string[] };
try {
  // --- Centro em uso na recarga -----------------------------------------------
  console.log("\nRecarga: centro em uso que saiu da planilha");
  const novo = await a.post("/cadastros/edicao/centros-custo", { codigoRM: "9.99.99999999", nomeRM: "TESTE REVISAO FINAL", ativo: true });
  criados.centro = novo.body.data?.registro?.id ?? null;
  ok(novo.status === 201 || novo.status === 200, `centro de teste criado pela tela (${novo.status}${novo.body.error ? ` ${novo.body.error}` : ""})`);
  const conta = await prisma.contaResultado.findFirstOrThrow({ where: { tipoConta: "ANALITICA", linhaDREId: { not: null }, ativo: true } });
  const lanc = await a.post(`/competencias/${anoMes}/lancamentos-manuais`, { motivo: "Teste", filial: 1, centroCustoId: criados.centro, contaResultadoId: conta.id, descricao: "Teste da revisão final", valor: "1.00" });
  criados.lancamento = lanc.body.data?.id ?? null;
  ok(lanc.status === 201, `lançamento manual no centro de teste (${lanc.status})`);
  const previa = (await recargaCadastrosService.previa(readFileSync(unidadesXlsx))) as { hash: string; centros: { removidos: Array<{ rotulo: string }>; mantidos: Array<{ rotulo: string }> } };
  const naPrevia = [...previa.centros.mantidos, ...previa.centros.removidos].find((m) => m.rotulo.startsWith("TESTE REVISAO FINAL"));
  ok(!!naPrevia && previa.centros.mantidos.includes(naPrevia), `a prévia mostra o centro como mantido: "${naPrevia?.rotulo}"`);
  await recargaCadastrosService.confirmar(previa.hash, ADMIN);
  const depois = criados.centro ? await prisma.centroCusto.findUnique({ where: { id: criados.centro } }) : null;
  ok(!!depois && depois.ativo === false, "depois da recarga o centro continua no cadastro, inativado");
  const l = criados.lancamento ? await prisma.lancamentoManual.findUnique({ where: { id: criados.lancamento } }) : null;
  ok(l?.centroCustoId === criados.centro, "e o lançamento continua com o centro");

  // --- Retrato: edição de lista sem mudar a quantidade --------------------------
  console.log("\nRetrato da apuração: edição de registro de lista");
  await a.post(`/competencias/${anoMes}/listas/producao-pista`, { valores: { Linha: "ALVEOLARES", Pistas: 1 } });
  const log = await prisma.auditLog.findFirst({ where: { entidade: "lista_operacional", acao: "CRIACAO" }, orderBy: { createdAt: "desc" } });
  criados.pista = log?.entidadeId ?? null;
  ok(!!criados.pista && !!(await prisma.producaoPista.findUnique({ where: { id: criados.pista } })), "o log da criação aponta o id do registro criado");
  ok((log?.dadosDepois as { quantidade?: unknown } | null)?.quantidade !== undefined, "e guarda o registro inteiro");
  await apuracaoService.apurar(ano, mes, ADMIN);
  ok((await apuracaoService.situacao(ano, mes)).mudancas.length === 0, "logo depois de apurar, nenhuma mudança acusada");
  await new Promise((r) => setTimeout(r, 20)); // a data de alteração precisa andar
  const ed = await a.put(`/competencias/${anoMes}/listas/producao-pista/${criados.pista}`, { valores: { Linha: "ESTACAS", Pistas: 1 } });
  ok(ed.status === 200 || ed.status === 204, `registro editado: pista de estacas, mesma quantidade (${ed.status})`);
  const mud = (await apuracaoService.situacao(ano, mes)).mudancas;
  ok(mud.some((m) => m.includes("pistas")), `a situação acusa a mudança: "${mud.find((m) => m.includes("pistas")) ?? "nada"}"`);
  const logEd = await prisma.auditLog.findFirst({ where: { entidade: "lista_operacional", acao: "ALTERACAO", entidadeId: criados.pista }, orderBy: { createdAt: "desc" } });
  ok((logEd?.dadosAntes as { quantidade?: unknown } | null)?.quantidade !== undefined && !!logEd?.dadosDepois, "o log da alteração guarda o registro antes e depois");

  // --- Trava ----------------------------------------------------------------------
  console.log("\nTrava da apuração");
  // Com o SQLite, a apuração não devolve a vez ao Node (o banco responde de forma
  // síncrona): o fechamento pedido no meio só é atendido quando ela termina. A
  // trava vale para o PostgreSQL. Aqui, o que se exige é que o fechamento nunca
  // pegue a apuração pela metade: ou é recusado, ou vem depois dela.
  const apurando = apuracaoService.apurar(ano, mes, ADMIN);
  const fechar = await a.post(`/competencias/${anoMes}/apuracao/fechar`);
  await apurando;
  const cf = await prisma.competencia.findUniqueOrThrow({ where: { id: competencia.id } });
  ok(
    (fechar.status === 409 && /sendo apurada/.test(fechar.body.error ?? "")) || (fechar.status === 200 && !!cf.fechadaEm && !!cf.apuradaEm && cf.fechadaEm >= cf.apuradaEm),
    fechar.status === 409 ? `fechar durante a apuração é recusado (${fechar.body.error})` : "o fechamento pedido durante a apuração só aconteceu depois dela (fechadaEm ≥ apuradaEm)",
  );
  if (cf.status === "FECHADA") await apuracaoService.reabrir(ano, mes, "Reaberta pela conferência da revisão final (teste da trava).", ADMIN);

  // --- Perfis e usuários ---------------------------------------------------------
  console.log("\nPerfis e usuários");
  const perfilRuim = await a.post("/perfis", { codigo: "TESTE_REVISAO", nome: "Teste revisão", recorteDepartamento: true, permissoes: [{ recurso: "DRE", acao: "LER" }, { recurso: "CLASSIFICACAO", acao: "LER" }] });
  ok(perfilRuim.status === 400, `recorte por departamento com leitura da classificação é recusado (${perfilRuim.body.error})`);
  const opcoes = (await a.get("/usuarios/opcoes")).body.data;
  const perfil = (codigo: string) => opcoes.perfis.find((p: { codigo: string }) => p.codigo === codigo).id as string;
  const setorRuim = await a.post("/usuarios", { nome: "Teste setor", email: "setor.revisao@bpm.com.br", senha: SENHA, perfilId: perfil("ALIMENTADOR"), setores: ["BALANCETE"] });
  ok(setorRuim.status === 400, `setor que não é lista (BALANCETE) é recusado (${setorRuim.body.error})`);
  if (setorRuim.body.data?.id) criados.usuarios.push(setorRuim.body.data.id);

  // --- Acesso à situação da apuração -------------------------------------------------
  console.log("\nAcesso à situação da apuração");
  for (const [email, codigo, setores, departamentos, esperado] of [
    ["alimentador.revisao@bpm.com.br", "ALIMENTADOR", ["PRODUCAO"], [], 403],
    ["gestor.revisao@bpm.com.br", "GESTAO", [], ["PRODUCAO"], 200],
  ] as const) {
    await prisma.usuario.deleteMany({ where: { email } });
    const r = await a.post("/usuarios", { nome: `Teste ${email.split("@")[0]}`, email, senha: SENHA, perfilId: perfil(codigo), setores, departamentos });
    criados.usuarios.push(r.body.data.id);
    const st = (await com((await login(email))!).get(`/competencias/${anoMes}/apuracao`)).status;
    ok(st === esperado, `${codigo === "GESTAO" ? "o Gestor (painel da DRE)" : "o Alimentador"}: ${st}`);
  }

  // --- Login -------------------------------------------------------------------------
  console.log("\nLimite de login");
  let ultimo = 0;
  for (let i = 0; i < 21; i++) ultimo = (await request(app).post("/auth/login").send({ email: "ninguem.revisao@bpm.com.br", password: "errada" })).status;
  ok(ultimo === 429, `a 21ª tentativa errada do mesmo e-mail é barrada (${ultimo})`);
  ok(!!(await login("admin@bpm.com", "admin123")), "e outro e-mail continua entrando");

  // --- Entradas inválidas ----------------------------------------------------------
  console.log("\nEntradas inválidas");
  ok((await a.post("/auditoria/acesso", { tela: `/${"x".repeat(500)}` })).status === 400, "tela de 500 caracteres no registro de acesso: 400");
  const jsonRuim = await request(app).post("/auth/login").set("Content-Type", "application/json").send('{"email": ');
  ok(jsonRuim.status === 400, `JSON malformado: ${jsonRuim.status} (${jsonRuim.body.error})`);
  ok((await a.get("/cadastros/edicao/constructor/definicao")).status === 404, "cadastro \"constructor\": 404");

  // --- Saldo inicial do estoque ------------------------------------------------------
  console.log("\nSaldo inicial do estoque");
  const imp = await request(app)
    .post(`/competencias/${anoMes}/importacoes`)
    .query({ tipo: "ESTOQUE_INICIAL", nomeArquivo: "listas.xlsx" })
    .set("Authorization", `Bearer ${admin}`)
    .set("Content-Type", "application/octet-stream")
    .send(readFileSync(listasXlsx));
  let status = imp.body.data?.status as string | undefined;
  for (let i = 0; i < 120 && status === "PROCESSANDO"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    status = (await a.get(`/importacoes/${imp.body.data.id}`)).body.data.status;
  }
  const det = imp.body.data?.id ? (await a.get(`/importacoes/${imp.body.data.id}`)).body.data : null;
  ok(status === "REJEITADA" && /saldo de estoque apurado/.test(det?.motivoRejeicao ?? ""), `no mês com saldo apurado, a importação é recusada (${status}: ${det?.motivoRejeicao ?? imp.body.error})`);
  ok((await prisma.estoqueSaldo.count({ where: { competenciaId: competencia.id, importacaoId: null } })) > 0, "e o saldo apurado continua lá");
} finally {
  // --- Limpeza ---------------------------------------------------------------------
  if (criados.pista) await prisma.producaoPista.delete({ where: { id: criados.pista } }).catch(() => undefined);
  if (criados.lancamento) await prisma.lancamentoManual.delete({ where: { id: criados.lancamento } }).catch(() => undefined);
  if (criados.centro) await prisma.centroCusto.delete({ where: { id: criados.centro } }).catch(() => undefined);
  for (const id of criados.usuarios) await prisma.usuario.delete({ where: { id } }).catch(() => undefined);
  await apuracaoService.apurar(ano, mes, ADMIN);
  const s = await apuracaoService.situacao(ano, mes);
  console.log(`\n(limpeza feita; ${anoMes} reapurada, ${s.mudancas.length} mudança(s) acusada(s))`);
}

console.log(falhas === 0 ? "\nTudo confere." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
