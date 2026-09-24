import { Router } from "express";

import { auditoriaController } from "../controllers/auditoriaController.js";
import { autenticacao } from "../middlewares/autenticacao.js";
import { validacao } from "../middlewares/validacao.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registrarAcessoSchema } from "../schemas/auditoria/registrarAcessoSchema.js";

export const auditoriaRoutes = Router();

auditoriaRoutes.post(
  "/acesso",
  autenticacao,
  validacao(registrarAcessoSchema),
  asyncHandler(auditoriaController.registrarAcesso),
);
