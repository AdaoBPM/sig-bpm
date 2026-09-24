import type { Request, Response } from "express";

import { authService } from "../services/authService.js";
import type { LoginInput } from "../schemas/auth/loginSchema.js";

export const authController = {
  async login(request: Request, response: Response) {
    try {
      const input = request.body as LoginInput;
      const result = await authService.login(input);
      return response.json({ data: result });
    } catch {
      return response.status(401).json({ error: "E-mail ou senha inválidos" });
    }
  },

  async me(request: Request, response: Response) {
    const payload = request.user;

    if (!payload) {
      return response.status(401).json({ error: "Não autenticado" });
    }

    const user = await authService.me(
      payload.sub,
      payload.email,
      payload.permissions,
    );

    return response.json({ data: user });
  },
};
