import { Router } from "express";

import { dreController as c } from "../../controllers/dre/dreController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** DRE apurada de uma competência: montado em /competencias/:anoMes/dre. */
export const dreRoutes = Router({ mergeParams: true });
dreRoutes.get("/", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.consultar));
dreRoutes.get("/consolidado", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.consolidado));
dreRoutes.get("/centros", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.centros));
dreRoutes.get("/obras", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.obras));
dreRoutes.get("/detalhe", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.detalhe));
dreRoutes.get("/volumes", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.volumes));
dreRoutes.get("/exportar", autenticacao, verificarPermissao("dre:ler"), asyncHandler(c.exportar));
dreRoutes.post("/apurar", autenticacao, verificarPermissao("apuracao:editar"), asyncHandler(c.apurar));
