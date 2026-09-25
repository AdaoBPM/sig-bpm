import { Router } from "express";

import { classificacaoController } from "../../controllers/classificacao/classificacaoController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Classificação de uma competência: montado em /competencias/:anoMes/classificacao. */
export const classificacaoRoutes = Router({ mergeParams: true });

classificacaoRoutes.get(
  "/",
  autenticacao,
  verificarPermissao("classificacao:ler"),
  asyncHandler(classificacaoController.resumo),
);

classificacaoRoutes.get(
  "/lancamentos",
  autenticacao,
  verificarPermissao("classificacao:ler"),
  asyncHandler(classificacaoController.listar),
);

/** Recalcula a classificação com o cadastro vigente, sem reimportar. */
classificacaoRoutes.post(
  "/",
  autenticacao,
  verificarPermissao("classificacao:editar"),
  asyncHandler(classificacaoController.reclassificar),
);
