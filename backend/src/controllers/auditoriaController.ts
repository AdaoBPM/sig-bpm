import type { Request, Response } from "express";
import { z } from "zod";

import type { RegistrarAcessoInput } from "../schemas/auditoria/registrarAcessoSchema.js";
import { auditoriaService } from "../services/auditoriaService.js";

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const filtroSchema = z.object({
  de: dia,
  ate: dia,
  usuarioId: z.string().trim().min(1).max(64).optional(),
  entidade: z.string().trim().max(60).optional(),
  entidadeId: z.string().trim().max(200).optional(),
  acao: z.string().trim().max(60).optional(),
  incluirAcessos: z.enum(["0", "1"]).default("0"),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
});

export const auditoriaController = {
  async registrarAcesso(request: Request, response: Response) {
    const body = request.body as RegistrarAcessoInput;
    const user = request.user!;
    await auditoriaService.registrarAcesso({
      usuarioId: user.sub,
      usuarioNome: user.nome,
      tela: body.tela,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return response.status(201).json({ data: { registrado: true } });
  },

  /** Consulta do log: período (dias, no fuso de Brasília), usuário, entidade e ação. */
  async consultar(request: Request, response: Response) {
    const f = filtroSchema.safeParse(request.query);
    if (!f.success) return response.status(400).json({ error: "Filtro inválido" });
    const { de, ate, incluirAcessos, ...resto } = f.data;
    return response.json({
      data: await auditoriaService.consultar({
        ...resto,
        de: de ? new Date(`${de}T00:00:00-03:00`) : undefined,
        ate: ate ? new Date(`${ate}T23:59:59.999-03:00`) : undefined,
        incluirAcessos: incluirAcessos === "1",
      }),
    });
  },

  async opcoes(_request: Request, response: Response) {
    return response.json({ data: await auditoriaService.opcoes() });
  },
};
