import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export type RegistrarAcessoParams = {
  usuarioId: string;
  usuarioNome: string;
  tela: string;
  ip?: string;
  userAgent?: string;
};

export const auditoriaService = {
  async registrarAcesso(params: RegistrarAcessoParams) {
    if (!env.enableAudit) {
      return;
    }

    const entry = {
      acao: "ACESSO",
      entidade: "tela",
      entidadeId: params.tela,
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome,
      ip: params.ip,
      userAgent: params.userAgent,
      metadados: { tela: params.tela },
    };

    try {
      if (prisma) {
        await prisma.auditLog.create({
          data: {
            acao: entry.acao,
            entidade: entry.entidade,
            entidadeId: entry.entidadeId,
            usuarioId: entry.usuarioId,
            usuarioNome: entry.usuarioNome,
            ip: entry.ip,
            userAgent: entry.userAgent,
            metadados: entry.metadados,
          },
        });
        return;
      }

      console.info("[AUDIT]", JSON.stringify(entry));
    } catch (error) {
      console.error("[AUDIT] Falha ao registrar acesso", {
        message: error instanceof Error ? error.message : "erro desconhecido",
        tela: params.tela,
        usuarioId: params.usuarioId,
      });
    }
  },
};
