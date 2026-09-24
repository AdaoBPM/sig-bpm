import type { Request, Response } from "express";

import { auditoriaService } from "../services/auditoriaService.js";
import type { RegistrarAcessoInput } from "../schemas/auditoria/registrarAcessoSchema.js";

export const auditoriaController = {
  async registrarAcesso(request: Request, response: Response) {
    const body = request.body as RegistrarAcessoInput;
    const user = request.user!;

    await auditoriaService.registrarAcesso({
      usuarioId: user.sub,
      usuarioNome: user.email,
      tela: body.tela,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return response.status(201).json({
      data: { registrado: true },
    });
  },
};
