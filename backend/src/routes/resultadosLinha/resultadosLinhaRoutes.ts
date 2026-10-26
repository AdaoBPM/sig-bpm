import express, { Router } from "express";

import { env } from "../../config/env.js";
import { resultadosLinhaController } from "../../controllers/resultadosLinha/resultadosLinhaController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Os Resultados por Linha (26/10/2026): a tela Resultados; a Importação (ler vê os documentos; editar importa). */
export const resultadosLinhaRoutes = Router();

resultadosLinhaRoutes.get("/", autenticacao, verificarPermissao("resultados_linha:ler"), asyncHandler(resultadosLinhaController.calcular));
resultadosLinhaRoutes.get("/documentos", autenticacao, verificarPermissao("resultados_linha_importacao:ler"), asyncHandler(resultadosLinhaController.documentos));
resultadosLinhaRoutes.post(
  "/documentos/:anoMes",
  autenticacao,
  verificarPermissao("resultados_linha_importacao:editar"),
  // Corpo cru: o arquivo inteiro, como nas importações da competência.
  express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }),
  asyncHandler(resultadosLinhaController.importarDocumentos),
);
