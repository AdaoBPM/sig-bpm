import type { Request, Response } from "express";
import { z } from "zod";

import type { LoginInput } from "../schemas/auth/loginSchema.js";
import { authService, RegraAuthError } from "../services/authService.js";
import { auditar } from "../services/auditoriaService.js";

export const novaSenhaSchema = z.string().min(8, "A senha precisa de ao menos 8 caracteres.").max(200);
const trocaSenhaSchema = z.object({ atual: z.string().min(1), nova: novaSenhaSchema });

export const authController = {
  async login(request: Request, response: Response) {
    const input = request.body as LoginInput;
    const origem = { ip: request.ip ?? null, userAgent: request.headers["user-agent"] ?? null };
    try {
      const data = await authService.login(input);
      await auditar({ usuarioId: data.user.id, usuarioNome: data.user.nome, acao: "LOGIN", entidade: "usuario", entidadeId: data.user.id, metadados: { nome: data.user.nome }, ...origem });
      return response.json({ data });
    } catch (error) {
      if (error instanceof RegraAuthError) {
        // O e-mail tentado, nunca a senha.
        await auditar({ usuarioId: null, acao: "LOGIN_FALHA", entidade: "usuario", metadados: { email: input.email }, ...origem });
        return response.status(error.status).json({ error: error.message });
      }
      throw error;
    }
  },

  async me(request: Request, response: Response) {
    return response.json({ data: await authService.me(request.user!) });
  },

  async trocarSenha(request: Request, response: Response) {
    const b = trocaSenhaSchema.safeParse(request.body);
    if (!b.success) return response.status(400).json({ error: b.error.issues[0]?.message ?? "Dados inválidos" });
    try {
      await authService.trocarSenha(request.user!.sub, b.data.atual, b.data.nova);
      await auditar({ usuarioId: request.user!.sub, usuarioNome: request.user!.nome, acao: "TROCA_SENHA", entidade: "usuario", entidadeId: request.user!.sub, metadados: { nome: request.user!.nome } });
      return response.status(204).end();
    } catch (error) {
      if (error instanceof RegraAuthError) return response.status(error.status).json({ error: error.message });
      throw error;
    }
  },
};
