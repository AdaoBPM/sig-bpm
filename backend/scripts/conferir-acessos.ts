/**
 * Conferência dos acessos (Passo 22), pela API, com usuários de teste:
 * - Alimentador (setor: produção m³): não alcança a DRE nem os cadastros, nem
 *   pela URL; só a lista e a importação do seu setor;
 * - Gestor com Produção e Técnico: vê a DRE inteira, mas só detalha as linhas
 *   dos seus departamentos e só vê os centros deles;
 * - Gestor sem departamento: vê a DRE, sem movimentações nem centros;
 * - perfis e usuários: inativar corta o acesso na hora; perfil de sistema não
 *   é excluído; ninguém se tranca para fora.
 * Os usuários e o perfil de teste são apagados no fim.
 *
 * Uso: npx tsx scripts/conferir-acessos.ts 2026 8
 */
import "dotenv/config";
import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";

const [anoTexto = "2026", mesTexto = "8"] = process.argv.slice(2);
const anoMes = `${anoTexto}-${String(mesTexto).padStart(2, "0")}`;
const prisma = getPrismaClient();
const SENHA = "senha-de-teste-1";
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};

async function login(email: string, senha = SENHA) {
  const r = await request(app).post("/auth/login").send({ email, password: senha });
  return r.status === 200 ? (r.body.data.token as string) : null;
}
const get = (t: string, url: string) => request(app).get(url).set("Authorization", `Bearer ${t}`);
const status = async (t: string, url: string) => (await get(t, url)).status;

const admin = (await login("admin@bpm.com", "admin123"))!;
ok(!!admin, "o usuário inicial (Contábil) entra com o login do banco");
const opcoes = (await get(admin, "/usuarios/opcoes")).body.data;
const perfil = (codigo: string) => opcoes.perfis.find((p: { codigo: string }) => p.codigo === codigo).id as string;
const criados: string[] = [];
async function criarUsuario(email: string, perfilId: string, setores: string[] = [], departamentos: string[] = []) {
  await prisma.usuario.deleteMany({ where: { email } });
  const r = await request(app)
    .post("/usuarios")
    .set("Authorization", `Bearer ${admin}`)
    .send({ nome: `Teste ${email.split("@")[0]}`, email, senha: SENHA, perfilId, setores, departamentos });
  if (r.status !== 201) throw new Error(`criar ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  criados.push(r.body.data.id);
  return r.body.data.id as string;
}
let perfilTeste: string | null = null;

try {
  // --- Alimentador -------------------------------------------------------
  console.log("\nAlimentador (setor: produção m³)");
  await criarUsuario("alimentador.teste@bpm.com.br", perfil("ALIMENTADOR"), ["PRODUCAO"]);
  const a = (await login("alimentador.teste@bpm.com.br"))!;
  ok((await status(a, `/competencias/${anoMes}/dre/consolidado`)) === 403, "não alcança a DRE (consolidado) pela URL da API");
  ok((await status(a, `/competencias/${anoMes}/dre?unidade=1`)) === 403, "não alcança a DRE da Matriz");
  ok((await status(a, `/competencias/${anoMes}/dre/detalhe?linha=CPP.MOD.REMUNERACOES_CLT`)) === 403, "não alcança o detalhamento");
  ok((await status(a, "/cadastros/centros-custo")) === 403, "não alcança os cadastros");
  ok((await status(a, `/competencias/${anoMes}/classificacao`)) === 403, "não alcança a classificação");
  ok((await status(a, "/usuarios")) === 403, "não alcança os usuários");
  ok((await status(a, `/competencias/${anoMes}/listas/producao`)) === 200, "vê a lista do seu setor (produção)");
  ok((await status(a, `/competencias/${anoMes}/listas/expedicao`)) === 403, "não vê a lista de outro setor (expedição)");
  const imp = async (tipo: string) =>
    (await request(app).post(`/competencias/${anoMes}/importacoes?tipo=${tipo}&nomeArquivo=x.xlsx`).set("Authorization", `Bearer ${a}`).set("Content-Type", "application/octet-stream").send(Buffer.from("x"))).status;
  ok((await imp("BALANCETE")) === 403, "não importa o balancete");
  ok((await imp("EXPEDICAO")) === 403, "não importa a lista de outro setor");
  const lista = (await get(a, `/competencias/${anoMes}/importacoes`)).body.data.itens as Array<{ tipo: string }>;
  ok(lista.length > 0 && lista.every((i) => i.tipo === "PRODUCAO"), `nas importações do mês, só vê as do seu setor (${lista.length})`);

  // --- Gestor com Produção e Técnico ------------------------------------
  console.log("\nGestor (Produção e Técnico)");
  const g = await criarUsuario("gestor.teste@bpm.com.br", perfil("GESTAO"), [], ["PRODUCAO", "TECNICO"]);
  const tg = (await login("gestor.teste@bpm.com.br"))!;
  const cons = await get(tg, `/competencias/${anoMes}/dre/consolidado`);
  const linhas = cons.body.data.linhas as Array<{ codigo: string; tipo: string; grupoSigla: string; descricao: string; valor: string | null; podeDetalhar: boolean }>;
  const itens = linhas.filter((l) => l.tipo === "ITEM" && l.valor !== null);
  ok(cons.status === 200 && itens.some((l) => l.grupoSigla === "ROB") && itens.some((l) => l.grupoSigla === "DA"), "vê a DRE inteira (receitas e despesas de todos os departamentos)");
  for (const u of [1, 2, 3, 4, 5]) ok((await status(tg, `/competencias/${anoMes}/dre?unidade=${u}`)) === 200, `vê a DRE da unidade ${u}`);
  const detalhaveis = new Set(itens.filter((l) => l.podeDetalhar).map((l) => l.grupoSigla));
  ok([...detalhaveis].sort().join(",") === "CPP,DT", `só pode detalhar linhas de CPP e DT (${[...detalhaveis].join(", ")})`);
  const linhaDe = (sigla: string) => itens.find((l) => l.grupoSigla === sigla)!.codigo;
  ok((await status(tg, `/competencias/${anoMes}/dre/detalhe?linha=${linhaDe("CPP")}`)) === 200, "detalha uma linha de Produção (CPP)");
  ok((await status(tg, `/competencias/${anoMes}/dre/detalhe?linha=${linhaDe("DT")}`)) === 200, "detalha uma linha de Técnico (DT)");
  ok((await status(tg, `/competencias/${anoMes}/dre/detalhe?linha=${linhaDe("DA")}`)) === 403, "não detalha uma linha Administrativa (DA), nem pela URL");
  ok((await status(tg, `/competencias/${anoMes}/dre/detalhe?linha=${linhaDe("ROB")}&unidade=1`)) === 403, "não detalha uma receita");
  const det = (await get(tg, `/competencias/${anoMes}/dre/detalhe?linha=CPP.MOD.REMUNERACOES_CLT&unidade=1`)).body.data;
  const rateio = det?.blocos?.find((b: { tipo: string }) => b.tipo === "RATEIO");
  ok(!!rateio && rateio.lancamentos.every((l: { valor: string; parcela: string }) => l.valor && l.parcela), "no rateio, vê o valor original e o rateado de cada lançamento");
  const grupos = (await get(tg, `/competencias/${anoMes}/dre/centros`)).body.data.grupos as Array<{ grupo: string; departamentos: string[] }>;
  ok(grupos.length > 0 && grupos.every((x) => x.departamentos.every((d) => /PRODUÇÃO \(CP\)|TÉCNICAS \(DT\)/.test(d))), `só vê centros de Produção e Técnico (${grupos.length} agrupamentos)`);
  ok((await status(tg, `/competencias/${anoMes}/dre/centros?grupo=${encodeURIComponent("FINANCEIRO")}`)) === 404, "não abre um centro administrativo (FINANCEIRO)");
  ok((await status(tg, `/competencias/${anoMes}/dre/detalhe?linha=${linhaDe("CPP")}&grupo=${encodeURIComponent("FINANCEIRO")}`)) === 403, "não detalha um centro administrativo pela URL");
  ok((await status(tg, `/competencias/${anoMes}/classificacao/lancamentos`)) === 403, "não alcança a classificação (os lançamentos crus)");
  ok((await request(app).post(`/competencias/${anoMes}/apuracao/apurar`).set("Authorization", `Bearer ${tg}`)).status === 403, "não apura");

  // Troca da própria senha
  ok((await request(app).put("/auth/senha").set("Authorization", `Bearer ${tg}`).send({ atual: "errada", nova: "nova-senha-1" })).status === 400, "trocar a senha exige a senha atual");
  ok((await request(app).put("/auth/senha").set("Authorization", `Bearer ${tg}`).send({ atual: SENHA, nova: "nova-senha-1" })).status === 204, "troca a própria senha");
  ok(!!(await login("gestor.teste@bpm.com.br", "nova-senha-1")), "entra com a senha nova");

  // Inativar corta na hora
  const u = (await get(admin, "/usuarios")).body.data.find((x: { id: string }) => x.id === g);
  await request(app).put(`/usuarios/${g}`).set("Authorization", `Bearer ${admin}`).send({ ...u, perfilId: u.perfil.id, ativo: false });
  ok((await status(tg, `/competencias/${anoMes}/dre/consolidado`)) === 401, "inativado, o token que ele já tinha deixa de valer na hora");
  ok(!(await login("gestor.teste@bpm.com.br", "nova-senha-1")), "inativado, não entra");

  // --- Gestor sem departamento ------------------------------------------
  console.log("\nGestor sem departamento");
  await criarUsuario("gestor.semdep.teste@bpm.com.br", perfil("GESTAO"));
  const ts = (await login("gestor.semdep.teste@bpm.com.br"))!;
  ok((await status(ts, `/competencias/${anoMes}/dre/consolidado`)) === 200, "vê a DRE");
  const l2 = (await get(ts, `/competencias/${anoMes}/dre/consolidado`)).body.data.linhas as Array<{ podeDetalhar: boolean; tipo: string }>;
  ok(l2.filter((l) => l.tipo === "ITEM").every((l) => !l.podeDetalhar), "nenhuma linha detalhável");
  ok((await status(ts, `/competencias/${anoMes}/dre/detalhe?linha=CPP.MOD.REMUNERACOES_CLT`)) === 403, "não detalha nada");
  ok(((await get(ts, `/competencias/${anoMes}/dre/centros`)).body.data.grupos as unknown[]).length === 0, "não vê centros de custo");

  // --- Perfis ----------------------------------------------------------
  console.log("\nPerfis");
  await prisma.perfil.deleteMany({ where: { codigo: "CONSULTA_TESTE" } });
  const cp = await request(app)
    .post("/perfis")
    .set("Authorization", `Bearer ${admin}`)
    .send({ codigo: "CONSULTA_TESTE", nome: "Consulta (teste)", descricao: "Tipo criado pela conferência", permissoes: [{ recurso: "DRE", acao: "LER" }] });
  perfilTeste = cp.body.data?.find((p: { codigo: string }) => p.codigo === "CONSULTA_TESTE")?.id ?? null;
  const pt = cp.body.data?.find((p: { codigo: string }) => p.codigo === "CONSULTA_TESTE");
  ok(cp.status === 201 && pt?.permissoes.length === 2, "cria um tipo de usuário novo, sem desenvolvimento (DRE ler ⇒ ver e ler)");
  await criarUsuario("consulta.teste@bpm.com.br", perfilTeste!);
  const tc = (await login("consulta.teste@bpm.com.br"))!;
  ok((await status(tc, `/competencias/${anoMes}/dre/consolidado`)) === 200, "o usuário do tipo novo vê a DRE");
  ok((await status(tc, `/competencias/${anoMes}/dre/detalhe?linha=${linhaDe("DA")}`)) === 200, "sem recorte no tipo, detalha qualquer linha");
  await request(app).put(`/perfis/${perfilTeste}`).set("Authorization", `Bearer ${admin}`).send({ ...pt, ativo: false });
  ok((await status(tc, `/competencias/${anoMes}/dre/consolidado`)) === 401, "tipo inativado: o usuário perde o acesso na hora");
  ok(!(await login("consulta.teste@bpm.com.br")), "tipo inativado: o usuário não entra");
  ok((await request(app).delete(`/perfis/${perfilTeste}`).set("Authorization", `Bearer ${admin}`)).status === 409, "não exclui um tipo com usuários");
  ok((await request(app).delete(`/perfis/${perfil("GESTAO")}`).set("Authorization", `Bearer ${admin}`)).status === 409, "não exclui um perfil de sistema");
  const contabil = (await get(admin, "/perfis")).body.data.find((p: { codigo: string }) => p.codigo === "CONTABIL");
  ok(
    (await request(app).put(`/perfis/${contabil.id}`).set("Authorization", `Bearer ${admin}`).send({ ...contabil, permissoes: [{ recurso: "DRE", acao: "LER" }] })).status === 409,
    "não tira do próprio perfil a edição de usuários",
  );
  const eu = (await get(admin, "/usuarios")).body.data.find((x: { email: string }) => x.email === "admin@bpm.com");
  ok((await request(app).put(`/usuarios/${eu.id}`).set("Authorization", `Bearer ${admin}`).send({ ...eu, perfilId: eu.perfil.id, ativo: false })).status === 409, "não inativa o próprio usuário");
} finally {
  await prisma.usuario.deleteMany({ where: { id: { in: criados } } });
  if (perfilTeste) await prisma.perfil.deleteMany({ where: { id: perfilTeste } });
  console.log("\nUsuários e perfil de teste apagados.");
}
console.log(falhas === 0 ? "Todos os acessos conferem." : `${falhas} verificação(ões) falharam.`);
await prisma.$disconnect();
process.exit(falhas ? 1 : 0);
