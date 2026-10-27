import { Router } from "express";

import { estoqueController as c } from "../../controllers/estoque/estoqueController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Saldo de estoque de uma competência: montado em /competencias/:anoMes/estoque. */
export const estoqueRoutes = Router({ mergeParams: true });
estoqueRoutes.get("/", autenticacao, verificarPermissao("previas.estoque:ler"), asyncHandler(c.consultar));
estoqueRoutes.post("/apurar", autenticacao, verificarPermissao("previas.estoque:editar"), asyncHandler(c.apurar));
