import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { AcaoPermissao, DepartamentoAcesso, RecursoSistema, TipoImportacao } from "../../generated/prisma/enums.js";
import { hashSenha } from "../../lib/senha.js";
import { ROTULO_DEPARTAMENTO } from "../acesso/recorteDepartamento.js";
import { DEFINICOES_LISTAS } from "../importacoes/listas/definicoesListas.js";
import { auditar } from "../auditoriaService.js";

/**
 * Usuários e perfis (Passo 22). O perfil é cadastro, não código: a empresa
 * cria tipos novos, inativa os existentes e define, em cada grupo de telas do
 * menu lateral, se o perfil lê ou edita (11/10/2026). Os recortes por dado (setores do Alimentador, departamentos do
 * Gestor) ficam no usuário e só valem se o perfil recorta.
 *
 * Travas contra se trancar para fora: ninguém inativa a si mesmo, troca o
 * próprio perfil, inativa o próprio perfil nem tira dele a edição de usuários.
 */

export class RegraUsuarioError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Os grupos de telas do menu lateral, na ordem do menu (11/10/2026). */
export const RECURSOS: RecursoSistema[] = [
  "CENARIOS_SINTETICOS",
  "CENARIOS_ANALITICOS",
  "RESULTADOS_REALIZADOS",
  "FECHAMENTO_MENSAL",
  "CADASTROS_APURACAO",
  "CADASTROS_CONTROLADORIA",
  "CONTROLE_USUARIOS",
];
const ROTULO_RECURSO: Record<RecursoSistema, string> = {
  CENARIOS_SINTETICOS: "Cenários Sintéticos",
  CENARIOS_ANALITICOS: "Cenários Analíticos",
  RESULTADOS_REALIZADOS: "Resultados Realizados",
  FECHAMENTO_MENSAL: "Fechamento Mensal",
  CADASTROS_APURACAO: "Cadastros da Apuração",
  CADASTROS_CONTROLADORIA: "Cadastros da Controladoria",
  CONTROLE_USUARIOS: "Controle de Usuários",
};
const ACOES: AcaoPermissao[] = ["LER", "EDITAR"];
const SETORES: Array<{ tipo: TipoImportacao; rotulo: string }> = [
  ...Object.values(DEFINICOES_LISTAS).map((d) => ({ tipo: d.tipo as TipoImportacao, rotulo: d.rotulo })),
  { tipo: "DEVOLUCAO", rotulo: "Devoluções" },
  { tipo: "SAIDA", rotulo: "Saídas" },
  { tipo: "MEDICAO", rotulo: "Medições" },
];
const DEPARTAMENTOS = Object.keys(ROTULO_DEPARTAMENTO) as DepartamentoAcesso[];

/** Setores são as listas operacionais: balancete, DRE do Comercial e saldo inicial não são de setor. */
function exigirSetores(setores: TipoImportacao[]) {
  const validos = new Set(SETORES.map((s) => s.tipo));
  const fora = setores.filter((s) => !validos.has(s));
  if (fora.length) throw new RegraUsuarioError(400, `Setor inválido: ${fora.join(", ")}. Os setores são as listas operacionais.`);
}


export type Permissao = { recurso: RecursoSistema; acao: AcaoPermissao };
export type DadosUsuario = {
  nome: string;
  email: string;
  perfilId: string;
  ativo: boolean;
  setores: TipoImportacao[];
  departamentos: DepartamentoAcesso[];
};
export type DadosPerfil = {
  nome: string;
  descricao: string | null;
  ativo: boolean;
  recorteSetor: boolean;
  recorteDepartamento: boolean;
  permissoes: Permissao[];
};

/**
 * EDITAR implica LER: a matriz gravada é sempre coerente. Os recortes não conflitam com os grupos: o que um perfil
 * recortado não pode ler (as telas de todos os departamentos, ou as fora das listas do setor) sai na hora de montar
 * as permissões das rotas (permissoesDasRotas, em acesso.ts).
 */
function normalizarPermissoes(ps: Permissao[]): Permissao[] {
  const nivel = { LER: 1, EDITAR: 2 } as const;
  const maior = new Map<RecursoSistema, number>();
  for (const p of ps) maior.set(p.recurso, Math.max(maior.get(p.recurso) ?? 0, nivel[p.acao]));
  return [...maior].flatMap(([recurso, n]) => ACOES.filter((a) => nivel[a] <= n).map((acao) => ({ recurso, acao })));
}

const selecaoUsuario = {
  id: true,
  nome: true,
  email: true,
  ativo: true,
  ordem: true,
  perfil: { select: { id: true, codigo: true, nome: true, recorteSetor: true, recorteDepartamento: true, ativo: true } },
  setores: { select: { tipoLista: true } },
  departamentos: { select: { departamento: true } },
} satisfies Prisma.UsuarioSelect;
type UsuarioLido = Prisma.UsuarioGetPayload<{ select: typeof selecaoUsuario }>;
const paraTela = (u: UsuarioLido) => ({
  ...u,
  setores: u.setores.map((s) => s.tipoLista),
  departamentos: u.departamentos.map((d) => d.departamento),
});

async function perfilExistente(id: string) {
  const p = await getPrismaClient().perfil.findUnique({ where: { id }, select: { id: true, ativo: true } });
  if (!p) throw new RegraUsuarioError(400, "Perfil inexistente.");
  return p;
}

export const usuariosService = {
  /** O que as telas oferecem: perfis, recursos e ações, setores e departamentos. */
  async opcoes() {
    const perfis = await getPrismaClient().perfil.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: { id: true, codigo: true, nome: true, ativo: true, recorteSetor: true, recorteDepartamento: true },
    });
    return {
      perfis,
      recursos: RECURSOS.map((r) => ({ recurso: r, rotulo: ROTULO_RECURSO[r] })),
      acoes: ACOES,
      setores: SETORES,
      departamentos: DEPARTAMENTOS.map((d) => ({ departamento: d, rotulo: ROTULO_DEPARTAMENTO[d] })),
    };
  },

  async listar() {
    const us = await getPrismaClient().usuario.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: selecaoUsuario });
    return us.map(paraTela);
  },

  async criar(d: DadosUsuario & { senha: string }, quem: string) {
    exigirSetores(d.setores);
    const prisma = getPrismaClient();
    await perfilExistente(d.perfilId);
    const email = d.email.trim().toLowerCase();
    if (await prisma.usuario.findUnique({ where: { email }, select: { id: true } })) throw new RegraUsuarioError(409, `Já existe um usuário com o e-mail ${email}.`);
    const u = await prisma.usuario.create({
      data: {
        nome: d.nome.trim(),
        email,
        senhaHash: await hashSenha(d.senha),
        perfilId: d.perfilId,
        ativo: d.ativo,
        ordem: (await prisma.usuario.count()) + 1,
        setores: { create: [...new Set(d.setores)].map((tipoLista) => ({ tipoLista })) },
        departamentos: { create: [...new Set(d.departamentos)].map((departamento) => ({ departamento })) },
      },
      select: selecaoUsuario,
    });
    const r = paraTela(u);
    await auditar({ usuarioId: quem, acao: "CRIACAO", entidade: "usuario", entidadeId: u.id, depois: r, metadados: { nome: r.nome } });
    return r;
  },

  async atualizar(id: string, d: DadosUsuario, quemEdita: string) {
    exigirSetores(d.setores);
    const prisma = getPrismaClient();
    const atual = await prisma.usuario.findUnique({ where: { id }, select: { id: true, perfilId: true } });
    if (!atual) throw new RegraUsuarioError(404, "Usuário não encontrado.");
    const antes = paraTela(await prisma.usuario.findUniqueOrThrow({ where: { id }, select: selecaoUsuario }));
    await perfilExistente(d.perfilId);
    if (id === quemEdita && !d.ativo) throw new RegraUsuarioError(409, "Você não pode inativar o seu próprio usuário.");
    if (id === quemEdita && d.perfilId !== atual.perfilId) throw new RegraUsuarioError(409, "Você não pode trocar o seu próprio perfil.");
    const email = d.email.trim().toLowerCase();
    const outro = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (outro && outro.id !== id) throw new RegraUsuarioError(409, `Já existe um usuário com o e-mail ${email}.`);
    const u = await prisma.$transaction(async (tx) => {
      await tx.usuarioSetor.deleteMany({ where: { usuarioId: id } });
      await tx.usuarioDepartamento.deleteMany({ where: { usuarioId: id } });
      return tx.usuario.update({
        where: { id },
        data: {
          nome: d.nome.trim(),
          email,
          perfilId: d.perfilId,
          ativo: d.ativo,
          setores: { create: [...new Set(d.setores)].map((tipoLista) => ({ tipoLista })) },
          departamentos: { create: [...new Set(d.departamentos)].map((departamento) => ({ departamento })) },
        },
        select: selecaoUsuario,
      });
    });
    const r = paraTela(u);
    await auditar({ usuarioId: quemEdita, acao: "ALTERACAO", entidade: "usuario", entidadeId: id, antes, depois: r, metadados: { nome: r.nome } });
    return r;
  },

  async redefinirSenha(id: string, senha: string, quem: string) {
    const prisma = getPrismaClient();
    if (!(await prisma.usuario.findUnique({ where: { id }, select: { id: true } }))) throw new RegraUsuarioError(404, "Usuário não encontrado.");
    await prisma.usuario.update({ where: { id }, data: { senhaHash: await hashSenha(senha) } });
    // A senha nunca vai para o log: só o fato.
    const nome = (await prisma.usuario.findUnique({ where: { id }, select: { nome: true } }))?.nome;
    await auditar({ usuarioId: quem, acao: "REDEFINICAO_SENHA", entidade: "usuario", entidadeId: id, metadados: { nome } });
  },

  // ------------------------------------------------------------- perfis

  async listarPerfis() {
    const ps = await getPrismaClient().perfil.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: {
        id: true,
        codigo: true,
        nome: true,
        descricao: true,
        sistema: true,
        ativo: true,
        ordem: true,
        recorteSetor: true,
        recorteDepartamento: true,
        permissoes: { select: { recurso: true, acao: true } },
        _count: { select: { usuarios: true } },
      },
    });
    return ps.map(({ _count, ...p }) => ({ ...p, usuarios: _count.usuarios }));
  },

  async criarPerfil(d: DadosPerfil & { codigo: string }, quem: string) {
    const prisma = getPrismaClient();
    const codigo = d.codigo.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (await prisma.perfil.findUnique({ where: { codigo }, select: { id: true } })) throw new RegraUsuarioError(409, `Já existe um perfil com o código ${codigo}.`);
    await prisma.perfil.create({
      data: {
        codigo,
        nome: d.nome.trim(),
        descricao: d.descricao?.trim() || null,
        ativo: d.ativo,
        recorteSetor: d.recorteSetor,
        recorteDepartamento: d.recorteDepartamento,
        ordem: (await prisma.perfil.count()) + 1,
        permissoes: { create: normalizarPermissoes(d.permissoes) },
      },
    });
    const lista = await this.listarPerfis();
    const criado = lista.find((p) => p.codigo === codigo);
    await auditar({ usuarioId: quem, acao: "CRIACAO", entidade: "perfil", entidadeId: criado?.id, depois: criado, metadados: { nome: criado?.nome } });
    return lista;
  },

  async atualizarPerfil(id: string, d: DadosPerfil, quemEdita: string) {
    const prisma = getPrismaClient();
    const atual = await prisma.perfil.findUnique({ where: { id }, select: { id: true } });
    if (!atual) throw new RegraUsuarioError(404, "Perfil não encontrado.");
    const antes = (await this.listarPerfis()).find((p) => p.id === id);
    const permissoes = normalizarPermissoes(d.permissoes);
    const meu = (await prisma.usuario.findUniqueOrThrow({ where: { id: quemEdita }, select: { perfilId: true } })).perfilId === id;
    if (meu && !d.ativo) throw new RegraUsuarioError(409, "Você não pode inativar o seu próprio perfil.");
    if (meu && !permissoes.some((p) => p.recurso === "CONTROLE_USUARIOS" && p.acao === "EDITAR")) {
      throw new RegraUsuarioError(409, "Você não pode tirar do seu próprio perfil a edição do Controle de Usuários.");
    }
    await prisma.$transaction([
      prisma.perfilPermissao.deleteMany({ where: { perfilId: id } }),
      prisma.perfil.update({
        where: { id },
        data: {
          nome: d.nome.trim(),
          descricao: d.descricao?.trim() || null,
          ativo: d.ativo,
          recorteSetor: d.recorteSetor,
          recorteDepartamento: d.recorteDepartamento,
          permissoes: { create: permissoes },
        },
      }),
    ]);
    const lista = await this.listarPerfis();
    await auditar({ usuarioId: quemEdita, acao: "ALTERACAO", entidade: "perfil", entidadeId: id, antes, depois: lista.find((p) => p.id === id), metadados: { nome: d.nome } });
    return lista;
  },

  /** Exclui um perfil que não é de sistema e não tem usuários. */
  async excluirPerfil(id: string, quem: string) {
    const prisma = getPrismaClient();
    const p = await prisma.perfil.findUnique({ where: { id }, select: { sistema: true, nome: true, _count: { select: { usuarios: true } } } });
    if (!p) throw new RegraUsuarioError(404, "Perfil não encontrado.");
    if (p.sistema) throw new RegraUsuarioError(409, `O perfil ${p.nome} é de sistema: pode ser inativado, mas não excluído.`);
    if (p._count.usuarios > 0) throw new RegraUsuarioError(409, `O perfil ${p.nome} tem ${p._count.usuarios} usuário(s); troque o perfil deles antes de excluir.`);
    const antes = (await this.listarPerfis()).find((x) => x.id === id);
    await prisma.perfil.delete({ where: { id } });
    await auditar({ usuarioId: quem, acao: "EXCLUSAO", entidade: "perfil", entidadeId: id, antes, metadados: { nome: antes?.nome } });
    return this.listarPerfis();
  },
};
