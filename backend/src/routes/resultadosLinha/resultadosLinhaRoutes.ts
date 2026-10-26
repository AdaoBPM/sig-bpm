import { Router } from "express";

import { resultadosLinhaController } from "../../controllers/resultadosLinha/resultadosLinhaController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * A etapa Linhas do Fechamento Mensal (26/10/2026): montado em /competencias/:anoMes/linhas. Ler vê a conferência do mês;
 * Editar grava as linhas de uma competência fechada antes da etapa (as demais gravam na apuração).
 */
export const resultadosLinhaRoutes = Router({ mergeParams: true });

resultadosLinhaRoutes.get("/", autenticacao, verificarPermissao("linhas_mes:ler"), asyncHandler(resultadosLinhaController.doMes));
resultadosLinhaRoutes.post("/gravar", autenticacao, verificarPermissao("linhas_mes:editar"), asyncHandler(resultadosLinhaController.gravar));
