import express, { Router } from "express";

import { exportacoesController as c } from "../../controllers/exportacoes/exportacoesController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * O Exportar das tabelas das telas (30/10/2026): montado em /exportacoes, antes do leitor de JSON comum (o limite de 1 MB),
 * com o seu (a tabela inteira de uma tela pode passar disso). Só pede o login: a tabela é a que o usuário já vê na tela.
 */
export const exportacoesRoutes = Router();
exportacoesRoutes.post("/tabela", express.json({ limit: "40mb" }), autenticacao, asyncHandler(c.tabela));
