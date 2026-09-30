import { env } from "../config/env.js";
import { getPrismaClient, prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

/**
 * Log de auditoria (Passo 23, RF011): quem fez o quê, quando, em qual registro,
 * com o estado antes e depois. É a tabela `audit_log` — o LogAuditoria do SPEC
 * (registroId = entidadeId, valorAnterior = dadosAntes, valorNovo =
 * dadosDepois, ocorridoEm = createdAt).
 *
 * Imutável: não há rota que altere ou apague registro, e gatilhos no banco
 * recusam UPDATE e DELETE na tabela. Uma falha ao auditar não desfaz a
 * operação já feita (Docs/seguranca/AUDITORIA-LOGS.md): vira log técnico.
 * Nunca se grava senha nem token.
 */

export type EventoAuditoria = {
  usuarioId: string | null;
  /** Se ausente, é lido do cadastro do usuário. */
  usuarioNome?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  metadados?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/** Ações registradas, com o rótulo da tela de consulta. */
export const ROTULO_ACAO: Record<string, string> = {
  ACESSO: "Acesso a tela",
  LOGIN: "Entrada no sistema",
  LOGIN_FALHA: "Tentativa de entrada recusada",
  TROCA_SENHA: "Troca da própria senha",
  CRIACAO: "Criação",
  ALTERACAO: "Alteração",
  EXCLUSAO: "Exclusão",
  REDEFINICAO_SENHA: "Senha redefinida",
  ABERTURA: "Abertura da competência",
  APURACAO: "Apuração da competência",
  APURACAO_PARCIAL: "Apuração de uma parte (avulsa)",
  FECHAMENTO: "Fechamento da competência",
  REABERTURA: "Reabertura da competência",
  IMPORTACAO: "Importação de arquivo",
  RECARGA_CADASTROS: "Recarga dos cadastros pela planilha",
  RECLASSIFICACAO: "Reclassificação dos lançamentos",
  COPIA_MES_ANTERIOR: "Cópia do mês anterior",
};

/** Entidades registradas, com o rótulo da tela de consulta. */
export const ROTULO_ENTIDADE: Record<string, string> = {
  tela: "Tela",
  usuario: "Usuário",
  perfil: "Perfil",
  competencia: "Competência",
  importacao: "Importação",
  cadastros: "Cadastros",
  classificacao: "Classificação",
  lancamento_manual: "Lançamento manual",
  lancamento_receita: "Lançamento de receita",
  lista_operacional: "Lista operacional",
  divergencia: "Divergência",
};

/** Deixa o JSON gravável: Decimal e Date viram texto, undefined some. */
const json = (x: unknown) => (x === undefined || x === null ? Prisma.DbNull : (JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue));

export async function auditar(e: EventoAuditoria) {
  if (!env.enableAudit) return;
  try {
    const db = getPrismaClient();
    let nome = e.usuarioNome ?? null;
    if (!nome && e.usuarioId) nome = (await db.usuario.findUnique({ where: { id: e.usuarioId }, select: { nome: true } }))?.nome ?? null;
    await db.auditLog.create({
      data: {
        acao: e.acao,
        entidade: e.entidade,
        entidadeId: e.entidadeId ?? null,
        usuarioId: e.usuarioId,
        usuarioNome: nome,
        ip: e.ip ?? null,
        userAgent: e.userAgent ?? null,
        dadosAntes: json(e.antes),
        dadosDepois: json(e.depois),
        metadados: json(e.metadados),
      },
    });
  } catch (error) {
    console.error("[AUDIT] Falha ao registrar", {
      message: error instanceof Error ? error.message : "erro desconhecido",
      acao: e.acao,
      entidade: e.entidade,
      entidadeId: e.entidadeId,
    });
  }
}

export type FiltroAuditoria = {
  de?: Date;
  ate?: Date;
  usuarioId?: string;
  entidade?: string;
  acao?: string;
  entidadeId?: string;
  incluirAcessos: boolean;
  pagina: number;
  porPagina: number;
};

export const auditoriaService = {
  async registrarAcesso(params: { usuarioId: string; usuarioNome: string; tela: string; ip?: string; userAgent?: string }) {
    if (!prisma) {
      console.info("[AUDIT]", JSON.stringify({ acao: "ACESSO", tela: params.tela, usuarioId: params.usuarioId }));
      return;
    }
    await auditar({
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      acao: "ACESSO",
      entidade: "tela",
      entidadeId: params.tela,
      metadados: { tela: params.tela },
      ip: params.ip,
      userAgent: params.userAgent,
    });
  },

  /** Consulta do log, do mais recente para o mais antigo. */
  async consultar(f: FiltroAuditoria) {
    const db = getPrismaClient();
    const where: Prisma.AuditLogWhereInput = {
      ...(f.de || f.ate ? { createdAt: { ...(f.de ? { gte: f.de } : {}), ...(f.ate ? { lte: f.ate } : {}) } } : {}),
      ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}),
      ...(f.entidade ? { entidade: f.entidade } : {}),
      ...(f.entidadeId ? { entidadeId: f.entidadeId } : {}),
      ...(f.acao ? { acao: f.acao } : !f.incluirAcessos ? { acao: { not: "ACESSO" } } : {}),
    };
    const [itens, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (f.pagina - 1) * f.porPagina,
        take: f.porPagina,
        select: { id: true, acao: true, entidade: true, entidadeId: true, usuarioId: true, usuarioNome: true, ip: true, dadosAntes: true, dadosDepois: true, metadados: true, createdAt: true },
      }),
      db.auditLog.count({ where }),
    ]);
    return { itens, total, pagina: f.pagina, porPagina: f.porPagina };
  },

  /** O que os filtros da tela oferecem: usuários que aparecem no log, ações e entidades. */
  async opcoes() {
    const db = getPrismaClient();
    const usuarios = await db.auditLog.groupBy({ by: ["usuarioId", "usuarioNome"], where: { usuarioId: { not: null } } });
    return {
      usuarios: usuarios
        .map((u) => ({ id: u.usuarioId!, nome: u.usuarioNome ?? u.usuarioId! }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      acoes: Object.entries(ROTULO_ACAO).map(([acao, rotulo]) => ({ acao, rotulo })),
      entidades: Object.entries(ROTULO_ENTIDADE).map(([entidade, rotulo]) => ({ entidade, rotulo })),
    };
  },
};
