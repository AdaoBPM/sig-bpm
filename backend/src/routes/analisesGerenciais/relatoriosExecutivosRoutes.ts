import { Router } from "express";

import { relatoriosExecutivosController as c } from "../../controllers/analisesGerenciais/relatoriosExecutivosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Os Relatórios Executivos (15/10/2026): montado em /relatorios-executivos. Ler a tela vê; editar cria e altera o seu. */
export const relatoriosExecutivosRoutes = Router();
const ler = verificarPermissao("relatorios_executivos:ler");
const editar = verificarPermissao("relatorios_executivos:editar");
relatoriosExecutivosRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
relatoriosExecutivosRoutes.post("/", autenticacao, editar, asyncHandler(c.criar));
relatoriosExecutivosRoutes.get("/:id", autenticacao, ler, asyncHandler(c.obter));
relatoriosExecutivosRoutes.get("/:id/dados", autenticacao, ler, asyncHandler(c.dados));
relatoriosExecutivosRoutes.put("/:id", autenticacao, editar, asyncHandler(c.gravar));
relatoriosExecutivosRoutes.post("/:id/finalizar", autenticacao, editar, asyncHandler(c.finalizar));
// Reabrir: o autor (editar) ou o Administrador (o serviço confere).
relatoriosExecutivosRoutes.post("/:id/reabrir", autenticacao, ler, asyncHandler(c.reabrir));
relatoriosExecutivosRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluir));
