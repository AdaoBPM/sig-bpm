import { Router } from "express";

import { receitaPreviaController as c } from "../../controllers/receitaPrevia/receitaPreviaController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const lerApuracao = verificarPermissao("apuracao:ler");
const apurar = verificarPermissao("apuracao:editar");
const lerLancamentos = verificarPermissao("lancamentos_manuais:ler");
const editarLancamentos = verificarPermissao("lancamentos_manuais:editar");

/** Receita prévia de uma competência: montado em /competencias/:anoMes/receita-previa. */
export const receitaPreviaRoutes = Router({ mergeParams: true });
receitaPreviaRoutes.get("/", autenticacao, lerApuracao, asyncHandler(c.consultar));
receitaPreviaRoutes.post("/apurar", autenticacao, apurar, asyncHandler(c.apurar));
receitaPreviaRoutes.get("/itens", autenticacao, lerApuracao, asyncHandler(c.itens));
receitaPreviaRoutes.get("/lancamentos", autenticacao, lerLancamentos, asyncHandler(c.listarLancamentos));
receitaPreviaRoutes.post("/lancamentos", autenticacao, editarLancamentos, asyncHandler(c.criarLancamento));

/** Um lançamento de receita pelo id, e as opções do formulário: montado em /lancamentos-receita. */
export const lancamentosReceitaRoutes = Router();
lancamentosReceitaRoutes.get("/opcoes", autenticacao, lerLancamentos, asyncHandler(c.opcoesLancamento));
lancamentosReceitaRoutes.put("/:id", autenticacao, editarLancamentos, asyncHandler(c.atualizarLancamento));
lancamentosReceitaRoutes.delete("/:id", autenticacao, editarLancamentos, asyncHandler(c.excluirLancamento));
