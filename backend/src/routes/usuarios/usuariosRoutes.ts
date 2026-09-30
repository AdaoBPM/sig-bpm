import { Router } from "express";

import { usuariosController as c } from "../../controllers/usuarios/usuariosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const ler = verificarPermissao("usuarios:ler");
const editar = verificarPermissao("usuarios:editar");

/** Usuários: montado em /usuarios. */
export const usuariosRoutes = Router();
usuariosRoutes.get("/opcoes", autenticacao, ler, asyncHandler(c.opcoes));
usuariosRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
usuariosRoutes.post("/", autenticacao, editar, asyncHandler(c.criar));
usuariosRoutes.put("/:id", autenticacao, editar, asyncHandler(c.atualizar));
usuariosRoutes.put("/:id/senha", autenticacao, editar, asyncHandler(c.redefinirSenha));

/** Perfis (tipos de usuário): montado em /perfis. */
export const perfisRoutes = Router();
perfisRoutes.get("/", autenticacao, ler, asyncHandler(c.listarPerfis));
perfisRoutes.post("/", autenticacao, editar, asyncHandler(c.criarPerfil));
perfisRoutes.put("/:id", autenticacao, editar, asyncHandler(c.atualizarPerfil));
perfisRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluirPerfil));
