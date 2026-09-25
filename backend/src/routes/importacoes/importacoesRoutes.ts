import express, { Router } from "express";

import { env } from "../../config/env.js";
import { importacoesController } from "../../controllers/importacoes/importacoesController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Importações de uma competência: montado em /competencias/:anoMes/importacoes. */
export const importacoesDaCompetenciaRoutes = Router({ mergeParams: true });

importacoesDaCompetenciaRoutes.get(
  "/",
  autenticacao,
  verificarPermissao("importacao:ler"),
  asyncHandler(importacoesController.listar),
);

importacoesDaCompetenciaRoutes.post(
  "/",
  autenticacao,
  verificarPermissao("importacao:editar"),
  // Corpo cru: o arquivo inteiro, em qualquer content-type.
  express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }),
  asyncHandler(importacoesController.receber),
);

/** Uma importação pelo id: montado em /importacoes. */
export const importacoesRoutes = Router();

importacoesRoutes.get(
  "/:id",
  autenticacao,
  verificarPermissao("importacao:ler"),
  asyncHandler(importacoesController.detalhar),
);
