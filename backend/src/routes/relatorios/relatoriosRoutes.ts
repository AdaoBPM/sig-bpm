import { Router } from "express";

import { relatoriosController as c } from "../../controllers/relatorios/relatoriosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Relatórios do exercício (Resultados e Indicadores): montado em /relatorios. */
export const relatoriosRoutes = Router();
relatoriosRoutes.get("/resultados", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.resultados));
relatoriosRoutes.get("/indicadores", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.indicadores));
