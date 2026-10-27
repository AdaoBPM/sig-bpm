import { Router } from "express";

import { usuariosController as c } from "../../controllers/usuarios/usuariosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarAlgumaPermissao, verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const ler = verificarPermissao("usuarios:ler");
const editar = verificarPermissao("usuarios:editar");

/** Usuários: montado em /usuarios. */
export const usuariosRoutes = Router();
// As opções (os perfis, os grupos e as telas) servem às telas Usuários e Perfis.
usuariosRoutes.get("/opcoes", autenticacao, verificarAlgumaPermissao("usuarios:ler", "perfis:ler"), asyncHandler(c.opcoes));
usuariosRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
usuariosRoutes.post("/", autenticacao, editar, asyncHandler(c.criar));
usuariosRoutes.put("/:id", autenticacao, editar, asyncHandler(c.atualizar));
usuariosRoutes.put("/:id/senha", autenticacao, editar, asyncHandler(c.redefinirSenha));

/**
 * Quem está online (24/10/2026): montado em /presenca. Todo usuário logado avisa (GET, que o modo de publicação não
 * recusa); só o Administrador recebe a lista. O DELETE tira o usuário ao sair.
 */
export const presencaRoutes = Router();
presencaRoutes.get("/", autenticacao, c.presenca);
presencaRoutes.delete("/", autenticacao, c.sairDaPresenca);

/** Perfis (tipos de usuário): montado em /perfis. */
export const perfisRoutes = Router();
// Os perfis têm a tela própria (14/10/2026); a lista também serve à tela Usuários.
perfisRoutes.get("/", autenticacao, verificarAlgumaPermissao("perfis:ler", "usuarios:ler"), asyncHandler(c.listarPerfis));
perfisRoutes.post("/", autenticacao, verificarPermissao("perfis:editar"), asyncHandler(c.criarPerfil));
perfisRoutes.put("/:id", autenticacao, verificarPermissao("perfis:editar"), asyncHandler(c.atualizarPerfil));
// Inativar e reativar (27/10/2026), a ação da lista.
perfisRoutes.patch("/:id/situacao", autenticacao, verificarPermissao("perfis:editar"), asyncHandler(c.mudarSituacaoPerfil));
perfisRoutes.delete("/:id", autenticacao, verificarPermissao("perfis:editar"), asyncHandler(c.excluirPerfil));
