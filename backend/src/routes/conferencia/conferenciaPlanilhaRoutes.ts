import express, { Router } from "express";

import { env } from "../../config/env.js";
import { conferenciaPlanilhaController as c } from "../../controllers/conferencia/conferenciaPlanilhaController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Conferência da DRE contra a planilha (Passo 27, RF013), do Contábil: ler o
 * relatório exige conferencia:ler (as visões, as abas da tela); enviar a planilha, conferencia:editar.
 * Montado em /competencias/:anoMes/conferencia-planilha.
 */
export const conferenciaPlanilhaRoutes = Router({ mergeParams: true });
conferenciaPlanilhaRoutes.get("/", autenticacao, verificarPermissao("conferencia:ler"), asyncHandler(c.relatorio));
conferenciaPlanilhaRoutes.post(
  "/",
  autenticacao,
  verificarPermissao("conferencia:editar"),
  // Corpo cru: o arquivo inteiro, em qualquer content-type.
  express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }),
  asyncHandler(c.receber),
);
