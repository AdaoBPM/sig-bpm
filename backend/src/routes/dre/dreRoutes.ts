import { Router } from "express";

import { dreController as c } from "../../controllers/dre/dreController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { lerResultados, verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** DRE apurada de uma competência: montado em /competencias/:anoMes/dre. */
export const dreRoutes = Router({ mergeParams: true });
dreRoutes.get("/", autenticacao, lerResultados, asyncHandler(c.consultar));
dreRoutes.get("/consolidado", autenticacao, lerResultados, asyncHandler(c.consolidado));
dreRoutes.get("/centros", autenticacao, lerResultados, asyncHandler(c.centros));
dreRoutes.get("/obras", autenticacao, lerResultados, asyncHandler(c.obras));
dreRoutes.get("/detalhe", autenticacao, lerResultados, asyncHandler(c.detalhe));
dreRoutes.get("/documentos", autenticacao, lerResultados, asyncHandler(c.documentos));
dreRoutes.get("/volumes", autenticacao, lerResultados, asyncHandler(c.volumes));
dreRoutes.get("/exportar", autenticacao, lerResultados, asyncHandler(c.exportar));
dreRoutes.post("/apurar", autenticacao, verificarPermissao("apuracao:editar"), asyncHandler(c.apurar));
