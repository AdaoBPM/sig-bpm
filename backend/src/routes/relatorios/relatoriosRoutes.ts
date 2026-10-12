import { Router } from "express";

import { relatoriosController as c } from "../../controllers/relatorios/relatoriosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { lerResultados } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Relatórios do exercício (Resultados, Indicadores e Painel de Bordo): montado em /relatorios. */
export const relatoriosRoutes = Router();
relatoriosRoutes.get("/resultados", autenticacao, lerResultados, asyncHandler(c.resultados));
relatoriosRoutes.get("/resultados/exportar", autenticacao, lerResultados, asyncHandler(c.exportarResultados));
relatoriosRoutes.get("/indicadores/exportar", autenticacao, lerResultados, asyncHandler(c.exportarIndicadores));
relatoriosRoutes.get("/indicadores", autenticacao, lerResultados, asyncHandler(c.indicadores));
relatoriosRoutes.get("/painel", autenticacao, lerResultados, asyncHandler(c.painel));
