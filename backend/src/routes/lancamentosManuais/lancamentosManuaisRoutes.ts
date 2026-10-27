import { Router } from "express";

import { lancamentosManuaisController as c } from "../../controllers/lancamentosManuais/lancamentosManuaisController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// As abas (27/10/2026): a Controladoria (os lançamentos digitados) e a Contestações (os vindos das contestações).
const ler = verificarPermissao("lancamentos_manuais.controladoria:ler");
const editar = verificarPermissao("lancamentos_manuais.controladoria:editar");
const lerContestacoes = verificarPermissao("lancamentos_manuais.contestacoes:ler");

/** Lançamentos de uma competência: montado em /competencias/:anoMes/lancamentos-manuais. */
export const lancamentosDaCompetenciaRoutes = Router({ mergeParams: true });
lancamentosDaCompetenciaRoutes.get("/", autenticacao, ler, asyncHandler(c.listar("controladoria")));
lancamentosDaCompetenciaRoutes.get("/contestacoes", autenticacao, lerContestacoes, asyncHandler(c.listar("contestacoes")));
lancamentosDaCompetenciaRoutes.post("/", autenticacao, editar, asyncHandler(c.criar));
lancamentosDaCompetenciaRoutes.post("/copiar-anterior", autenticacao, editar, asyncHandler(c.copiarDoMesAnterior));

/** Um lançamento pelo id, e as opções do formulário: montado em /lancamentos-manuais. */
export const lancamentosManuaisRoutes = Router();
lancamentosManuaisRoutes.get("/opcoes", autenticacao, ler, asyncHandler(c.opcoes));
lancamentosManuaisRoutes.put("/:id", autenticacao, editar, asyncHandler(c.atualizar));
lancamentosManuaisRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluir));
