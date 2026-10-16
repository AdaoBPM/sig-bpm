import express, { Router } from "express";

import { relatoriosExecutivosController as c } from "../../controllers/analisesGerenciais/relatoriosExecutivosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Os Relatórios Executivos (15/10/2026): montado em /relatorios-executivos. Ler a tela vê (as abas finalizadas e as do
 * recorte); editar cria o relatório da competência e altera as abas do recorte. Reabrir: quem edita a aba ou o
 * Administrador (o serviço confere).
 */
export const relatoriosExecutivosRoutes = Router();
const ler = verificarPermissao("relatorios_executivos:ler");
const editar = verificarPermissao("relatorios_executivos:editar");
relatoriosExecutivosRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
relatoriosExecutivosRoutes.post("/", autenticacao, editar, asyncHandler(c.criar));
relatoriosExecutivosRoutes.get("/:id", autenticacao, ler, asyncHandler(c.obter));
relatoriosExecutivosRoutes.get("/:id/dados", autenticacao, ler, asyncHandler(c.dados));
relatoriosExecutivosRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluir));
// As fotos (16/10/2026): o arquivo cru no corpo (até 10 MB).
relatoriosExecutivosRoutes.post("/:id/fotos", autenticacao, editar, express.raw({ type: () => true, limit: "10mb" }), asyncHandler(c.salvarFoto));
relatoriosExecutivosRoutes.get("/:id/fotos/:arquivo", autenticacao, ler, asyncHandler(c.lerFoto));
relatoriosExecutivosRoutes.put("/:id/abas/:departamento", autenticacao, editar, asyncHandler(c.gravarAba));
relatoriosExecutivosRoutes.post("/:id/abas/:departamento/finalizar", autenticacao, editar, asyncHandler(c.finalizarAba));
relatoriosExecutivosRoutes.post("/:id/abas/:departamento/reabrir", autenticacao, ler, asyncHandler(c.reabrirAba));
