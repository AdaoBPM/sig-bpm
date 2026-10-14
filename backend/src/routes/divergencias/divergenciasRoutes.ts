import { Router } from "express";

import { divergenciasController as c } from "../../controllers/divergencias/divergenciasController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Divergências retroativas (Passo 24): montado em /divergencias. */
export const divergenciasRoutes = Router();
divergenciasRoutes.get("/", autenticacao, verificarPermissao("divergencia:ler"), asyncHandler(c.listar));
divergenciasRoutes.post("/justificar", autenticacao, verificarPermissao("divergencia:editar"), asyncHandler(c.justificar));
// Resolver é reabrir a competência: exige também a permissão de reabrir.
divergenciasRoutes.post("/resolver", autenticacao, verificarPermissao("divergencia:editar"), verificarPermissao("competencias:editar"), asyncHandler(c.resolver));
