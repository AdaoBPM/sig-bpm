import { Router } from "express";

import { cadastrosController } from "../../controllers/cadastros/cadastrosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const cadastrosRoutes = Router();

// Somente leitura no Passo 8. A escrita entra no Passo 25, junto com a
// verificação de permissão por recurso e ação.
cadastrosRoutes.get(
  "/resumo",
  autenticacao,
  asyncHandler(cadastrosController.resumo),
);

cadastrosRoutes.get(
  "/centros-custo",
  autenticacao,
  asyncHandler(cadastrosController.listarCentrosCusto),
);

cadastrosRoutes.get(
  "/contas-resultado",
  autenticacao,
  asyncHandler(cadastrosController.listarContasResultado),
);

cadastrosRoutes.get(
  "/linhas-dre",
  autenticacao,
  asyncHandler(cadastrosController.listarLinhasDRE),
);
