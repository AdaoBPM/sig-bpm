import { Router } from "express";

import { relatoriosController as c } from "../../controllers/relatorios/relatoriosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Relatórios do exercício (Resultados, Indicadores e Painel de Bordo): montado em /relatorios. */
export const relatoriosRoutes = Router();
relatoriosRoutes.get("/resultados", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.resultados));
relatoriosRoutes.get("/resultados/exportar", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.exportarResultados));
relatoriosRoutes.get("/indicadores/exportar", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.exportarIndicadores));
relatoriosRoutes.get("/indicadores", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.indicadores));
relatoriosRoutes.get("/painel", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.painel));
