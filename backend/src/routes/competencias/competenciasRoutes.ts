import { Router } from "express";

import { competenciasController } from "../../controllers/competencias/competenciasController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const competenciasRoutes = Router();

competenciasRoutes.get(
  "/",
  autenticacao,
  asyncHandler(competenciasController.listar),
);

competenciasRoutes.post(
  "/",
  autenticacao,
  asyncHandler(competenciasController.abrir),
);
