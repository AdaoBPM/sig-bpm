import { Router } from "express";

import { creditosImpostosController } from "../../controllers/impostos/creditosImpostosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Os Créditos de Impostos do mês (03/11/2026; desde 04/11/2026, a aba Impostos dos Resultados do Fechamento Mensal): montado em /competencias/:anoMes/impostos. */
export const creditosImpostosRoutes = Router({ mergeParams: true });

creditosImpostosRoutes.get("/", autenticacao, verificarPermissao("dre.impostos:ler"), asyncHandler(creditosImpostosController.doMes));
