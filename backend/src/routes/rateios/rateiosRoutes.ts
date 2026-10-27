import { Router } from "express";

import { rateiosController as c } from "../../controllers/rateios/rateiosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Volumes e percentuais de rateio de uma competência: montado em /competencias/:anoMes/rateios. */
export const rateiosRoutes = Router({ mergeParams: true });
rateiosRoutes.get("/", autenticacao, verificarPermissao("totais.rateios:ler"), asyncHandler(c.consultar));
rateiosRoutes.post("/apurar", autenticacao, verificarPermissao("totais.rateios:editar"), asyncHandler(c.apurar));
