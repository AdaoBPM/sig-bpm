import { Router } from "express";

import { apuracaoController as c } from "../../controllers/apuracao/apuracaoController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarAlgumaPermissao, verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Apuração congelada, fechamento e reabertura: montado em /competencias/:anoMes/apuracao. */
export const apuracaoRoutes = Router({ mergeParams: true });
// A situação aparece nas telas de DRE, classificação, rateios, receita e estoque.
apuracaoRoutes.get("/", autenticacao, verificarAlgumaPermissao("dre:ler", "classificacao:ler", "apuracao:ler"), asyncHandler(c.situacao));
apuracaoRoutes.post("/apurar", autenticacao, verificarPermissao("apuracao:editar"), asyncHandler(c.apurar));
apuracaoRoutes.post("/fechar", autenticacao, verificarPermissao("competencia:editar"), asyncHandler(c.fechar));
apuracaoRoutes.post("/reabrir", autenticacao, verificarPermissao("competencia:editar"), asyncHandler(c.reabrir));
