import { Router } from "express";

import { listasController as c } from "../../controllers/listas/listasController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const ler = verificarPermissao("listas_operacionais:ler");
const editar = verificarPermissao("listas_operacionais:editar");

/** Listas de uma competência: montado em /competencias/:anoMes/listas. */
export const listasDaCompetenciaRoutes = Router({ mergeParams: true });
listasDaCompetenciaRoutes.get("/indicadores/:setor", autenticacao, ler, asyncHandler(c.indicadores));
listasDaCompetenciaRoutes.post("/indicadores/:setor", autenticacao, editar, asyncHandler(c.digitarIndicador));
listasDaCompetenciaRoutes.get("/quadro-de-lotacao", autenticacao, ler, asyncHandler(c.lotacao));
listasDaCompetenciaRoutes.get("/:tipo", autenticacao, ler, asyncHandler(c.listar));
listasDaCompetenciaRoutes.post("/:tipo", autenticacao, editar, asyncHandler(c.criar));
listasDaCompetenciaRoutes.put("/:tipo/:id", autenticacao, editar, asyncHandler(c.atualizar));
listasDaCompetenciaRoutes.delete("/:tipo/:id", autenticacao, editar, asyncHandler(c.excluir));

/** Definição dos formulários: montado em /listas. */
export const listasRoutes = Router();
listasRoutes.get("/campos", autenticacao, ler, asyncHandler(c.campos));
