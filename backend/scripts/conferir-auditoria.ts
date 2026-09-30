/**
 * Conferência do log de auditoria (Passo 23), pela API:
 * - fechar e reabrir uma competência e ver os registros, com autor, data,
 *   estado antes e depois e a justificativa;
 * - criar, alterar e excluir um lançamento manual, com antes e depois;
 * - criar usuário e perfil, redefinir senha (sem a senha no log);
 * - login certo e recusado (o e-mail tentado, nunca a senha);
 * - uma importação, com o resultado do processamento;
 * - a consulta filtra por período, usuário, entidade e ação, e exige
 *   auditoria:ler;
 * - o log é imutável: o banco recusa alterar e excluir registros.
 * No fim a competência é reapurada, e o usuário e o perfil de teste são
 * apagados (os registros de auditoria deles ficam, como deve ser).
 *
 * Uso: npx tsx scripts/conferir-auditoria.ts 2026 8 "<LISTAS REALIZADO (OPERAÇÃO).xlsx>"
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import request from "supertest";

import { app } from "../src/app.js";
import { getPrismaClient } from "../src/config/prisma.js";

const [anoTexto = "2026", mesTexto = "8", arquivoListas] = process.argv.slice(2);
const anoMes = `${anoTexto}-${String(mesTexto).padStart(2, "0")}`;
const prisma = getPrismaClient();
let falhas = 0;
const ok = (cond: boolean, texto: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${texto}`);
  if (!cond) falhas++;
};
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inicio = new Date();

const login = async (email: string, senha: string) => (await request(app).post("/auth/login").send({ email, password: senha })).body.data?.token as string | undefined;
const admin = (await login("admin@bpm.com", "admin123"))!;
const eu = (await request(app).get("/auth/me").set("Authorization", `Bearer ${admin}`)).body.data;
const api = {
  get: (url: string, t = admin) => request(app).get(url).set("Authorization", `Bearer ${t}`),
  post: (url: string, body?: object, t = admin) => request(app).post(url).set("Authorization", `Bearer ${t}`).send(body ?? {}),
  put: (url: string, body: object) => request(app).put(url).set("Authorization", `Bearer ${admin}`).send(body),
  del: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${admin}`),
};
/** Os registros novos desta conferência, do mais recente para o mais antigo. */
const novos = async (filtro: Record<string, string> = {}) =>
  (await api.get(`/auditoria?${new URLSearchParams({ porPagina: "200", ...filtro })}`)).body.data.itens.filter((r: { createdAt: string }) => new Date(r.createdAt) >= inicio) as Array<{
    acao: string;
    entidade: string;
    entidadeId: string;
    usuarioId: string | null;
    usuarioNome: string | null;
    dadosAntes: Record<string, unknown> | null;
    dadosDepois: Record<string, unknown> | null;
    metadados: Record<string, unknown> | null;
    createdAt: string;
  }>;

console.log("Login");
await login("admin@bpm.com", "errada");
const logins = await novos({ entidade: "usuario" });
ok(logins.some((r) => r.acao === "LOGIN" && r.usuarioId === eu.id), "entrada registrada, com o usuário");
const falha = logins.find((r) => r.acao === "LOGIN_FALHA");
ok(!!falha && falha.metadados?.email === "admin@bpm.com" && !JSON.stringify(falha).includes("errada"), "tentativa recusada registrada com o e-mail, sem a senha");

console.log(`\nFechar e reabrir ${anoMes}`);
const f = await api.post(`/competencias/${anoMes}/apuracao/fechar`);
ok(f.status === 200 && f.body.data.competencia.status === "FECHADA", "competência fechada");
const r = await api.post(`/competencias/${anoMes}/apuracao/reabrir`, { justificativa: "Conferência do Passo 23: registro do fechamento e da reabertura." });
ok(r.status === 200 && r.body.data.competencia.status === "ABERTA", "competência reaberta");
const comp = await novos({ entidade: "competencia" });
const fech = comp.find((x) => x.acao === "FECHAMENTO");
const reab = comp.find((x) => x.acao === "REABERTURA");
ok(!!fech && fech.usuarioNome === eu.nome && fech.dadosAntes?.status === "EM_CONFERENCIA" && fech.dadosDepois?.status === "FECHADA", `fechamento: autor ${fech?.usuarioNome}, ${fech?.dadosAntes?.status} → ${fech?.dadosDepois?.status}, em ${fech?.createdAt}`);
ok(!!reab && reab.dadosAntes?.status === "FECHADA" && reab.dadosDepois?.status === "ABERTA" && String(reab.metadados?.justificativa).startsWith("Conferência do Passo 23"), "reabertura: FECHADA → ABERTA, com a justificativa");

console.log("\nLançamento manual");
const op = (await api.get("/lancamentos-manuais/opcoes")).body.data;
const conta = op.contas[0];
const criado = await api.post(`/competencias/${anoMes}/lancamentos-manuais`, { motivo: "TESTE AUDITORIA", filial: 1, centroCustoId: null, contaResultadoId: conta.id, descricao: "Teste da auditoria", valor: "123.45" });
ok(criado.status === 201, "criado");
const idl = criado.body.data.id;
await api.put(`/lancamentos-manuais/${idl}`, { motivo: "TESTE AUDITORIA", filial: 1, centroCustoId: null, contaResultadoId: conta.id, descricao: "Teste da auditoria", valor: "200.00" });
await api.del(`/lancamentos-manuais/${idl}`);
const lm = (await novos({ entidade: "lancamento_manual" })).filter((x) => x.entidadeId === idl);
const alt = lm.find((x) => x.acao === "ALTERACAO");
ok(lm.some((x) => x.acao === "CRIACAO" && x.dadosDepois?.valor === "123.45"), "criação com o estado depois");
ok(!!alt && alt.dadosAntes?.valor === "123.45" && alt.dadosDepois?.valor === "200.00", "alteração com antes (123,45) e depois (200,00)");
ok(lm.some((x) => x.acao === "EXCLUSAO" && x.dadosAntes?.valor === "200.00"), "exclusão com o estado antes");

console.log("\nUsuários e perfis");
await prisma.usuario.deleteMany({ where: { email: "auditoria.teste@bpm.com.br" } });
await prisma.perfil.deleteMany({ where: { codigo: "AUDITORIA_TESTE" } });
const p = await api.post("/perfis", { codigo: "AUDITORIA_TESTE", nome: "Auditoria (teste)", permissoes: [{ recurso: "DRE", acao: "LER" }] });
const perfil = p.body.data.find((x: { codigo: string }) => x.codigo === "AUDITORIA_TESTE");
await api.put(`/perfis/${perfil.id}`, { ...perfil, permissoes: [{ recurso: "DRE", acao: "LER" }, { recurso: "AUDITORIA", acao: "LER" }] });
const u = await api.post("/usuarios", { nome: "Auditoria Teste", email: "auditoria.teste@bpm.com.br", senha: "senha-secreta-9", perfilId: perfil.id });
await api.put(`/usuarios/${u.body.data.id}/senha`, { senha: "outra-senha-secreta-9" });
const up = [...(await novos({ entidade: "perfil" })), ...(await novos({ entidade: "usuario" }))];
const altPerfil = up.find((x) => x.acao === "ALTERACAO" && x.entidadeId === perfil.id);
ok(up.some((x) => x.acao === "CRIACAO" && x.entidade === "perfil"), "perfil criado registrado");
ok(!!altPerfil && JSON.stringify(altPerfil.dadosAntes).includes("DRE") && JSON.stringify(altPerfil.dadosDepois).includes("AUDITORIA"), "alteração de permissões com antes e depois");
ok(up.some((x) => x.acao === "CRIACAO" && x.entidade === "usuario" && x.entidadeId === u.body.data.id), "usuário criado registrado");
ok(up.some((x) => x.acao === "REDEFINICAO_SENHA") && !JSON.stringify(up).includes("senha-secreta"), "redefinição de senha registrada, sem a senha");
const tu = (await login("auditoria.teste@bpm.com.br", "outra-senha-secreta-9"))!;
ok((await api.get("/auditoria", tu)).status === 200, "perfil com auditoria:ler consulta o log");
const sem = await api.put(`/perfis/${perfil.id}`, { ...perfil, permissoes: [{ recurso: "DRE", acao: "LER" }] });
ok(sem.status === 200 && (await api.get("/auditoria", tu)).status === 403, "sem auditoria:ler, a consulta é recusada");

if (arquivoListas) {
  console.log("\nImportação");
  const imp = await request(app)
    .post(`/competencias/${anoMes}/importacoes?tipo=ACOMPANHAMENTO&nomeArquivo=listas.xlsx&forcar=1`)
    .set("Authorization", `Bearer ${admin}`)
    .set("Content-Type", "application/octet-stream")
    .send(readFileSync(arquivoListas));
  const idi = imp.body.data?.id;
  let reg;
  for (let i = 0; i < 90 && !reg; i++) {
    await espera(1000);
    reg = (await novos({ entidade: "importacao" })).find((x) => x.entidadeId === idi);
  }
  ok(!!reg && reg.dadosDepois?.status === "CONCLUIDA" && reg.metadados?.tipo === "ACOMPANHAMENTO", `importação registrada com o resultado (${reg?.dadosDepois?.status}, ${reg?.dadosDepois?.linhasAceitas} linha(s) aceitas)`);
  ok(!!reg?.dadosAntes?.substituiu, "e com a importação que ela substituiu");
}

console.log("\nConsulta");
const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const porPeriodo = await novos({ de: hoje, ate: hoje });
ok(porPeriodo.length > 0, `filtro por período (hoje): ${porPeriodo.length} registro(s) desta conferência`);
const porUsuario = await novos({ usuarioId: eu.id, entidade: "competencia", acao: "REABERTURA" });
ok(porUsuario.length === 1 && porUsuario[0].acao === "REABERTURA", "filtro por usuário, entidade e ação");
ok(((await api.get("/auditoria?de=2000-01-01&ate=2000-01-31")).body.data.total as number) === 0, "período sem registros volta vazio");

console.log("\nImutabilidade");
const qualquer = await prisma.auditLog.findFirstOrThrow({ select: { id: true } });
// O Prisma traduz o erro do gatilho de formas diferentes (no DELETE, como violação de
// chave estrangeira); o que vale é que a operação falha e o registro continua igual.
const total = await prisma.auditLog.count();
const recusa = async (nome: string, fn: () => Promise<unknown>) => {
  let aceito = true;
  try {
    await fn();
  } catch {
    aceito = false;
  }
  const depois = await prisma.auditLog.findUnique({ where: { id: qualquer.id }, select: { acao: true } });
  ok(!aceito && !!depois && depois.acao !== "ADULTERADO" && (await prisma.auditLog.count()) >= total, `${nome}: recusado pelo banco, o registro continua igual`);
};
await recusa("alterar um registro", () => prisma.auditLog.update({ where: { id: qualquer.id }, data: { acao: "ADULTERADO" } }));
await recusa("excluir um registro", () => prisma.auditLog.delete({ where: { id: qualquer.id } }));
await recusa("excluir tudo, direto em SQL", () => prisma.$executeRawUnsafe("DELETE FROM audit_log"));
ok((await request(app).delete(`/auditoria/${qualquer.id}`).set("Authorization", `Bearer ${admin}`)).status === 404, "a API não tem rota para excluir");

// Arrumação: a competência volta a ficar apurada; usuário e perfil de teste saem (o log deles fica).
await api.post(`/competencias/${anoMes}/apuracao/apurar`);
await prisma.usuario.deleteMany({ where: { email: "auditoria.teste@bpm.com.br" } });
await prisma.perfil.deleteMany({ where: { codigo: "AUDITORIA_TESTE" } });
ok((await novos({ acao: "APURACAO" })).length > 0, `${anoMes} reapurada, e a apuração também ficou no log`);

console.log(falhas === 0 ? "\nA auditoria confere." : `\n${falhas} verificação(ões) falharam.`);
await prisma.$disconnect();
process.exit(falhas ? 1 : 0);
