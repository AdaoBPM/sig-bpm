import type { Request, Response } from "express";
import { z } from "zod";

import type { LoginInput } from "../schemas/auth/loginSchema.js";
import { authService, RegraAuthError } from "../services/authService.js";

export const novaSenhaSchema = z.string().min(8, "A senha precisa de ao menos 8 caracteres.").max(200);
const trocaSenhaSchema = z.object({ atual: z.string().min(1), nova: novaSenhaSchema });

export const authController = {
  async login(request: Request, response: Response) {
    try {
      return response.json({ data: await authService.login(request.body as LoginInput) });
    } catch (error) {
      if (error instanceof RegraAuthError) return response.status(error.status).json({ error: error.message });
      throw error;
    }
  },

  async me(request: Request, response: Response) {
    return response.json({ data: authService.me(request.user!) });
  },

  async trocarSenha(request: Request, response: Response) {
    const b = trocaSenhaSchema.safeParse(request.body);
    if (!b.success) return response.status(400).json({ error: b.error.issues[0]?.message ?? "Dados inválidos" });
    try {
      await authService.trocarSenha(request.user!.sub, b.data.atual, b.data.nova);
      return response.status(204).end();
    } catch (error) {
      if (error instanceof RegraAuthError) return response.status(error.status).json({ error: error.message });
      throw error;
    }
  },
};
