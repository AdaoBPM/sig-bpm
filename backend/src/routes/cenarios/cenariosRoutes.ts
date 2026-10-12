import express, { Router } from "express";

import { env } from "../../config/env.js";
import { cenariosController as c } from "../../controllers/cenarios/cenariosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/** Criação de Cenários (os cenários sintéticos): montado em /cenarios. */
export const cenariosRoutes = Router();
const ler = verificarPermissao("cenarios:ler");
const editar = verificarPermissao("cenarios:editar");
cenariosRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
cenariosRoutes.post("/", autenticacao, editar, express.json(), asyncHandler(c.criar));
cenariosRoutes.post("/importar/analise", autenticacao, editar, express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }), asyncHandler(c.analisar));
cenariosRoutes.post("/importar", autenticacao, editar, express.json(), asyncHandler(c.importar));
cenariosRoutes.get("/:id", autenticacao, ler, asyncHandler(c.obter));
cenariosRoutes.patch("/:id", autenticacao, editar, express.json(), asyncHandler(c.atualizar));
cenariosRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluir));
cenariosRoutes.put("/:id/marcacao", autenticacao, editar, express.json(), asyncHandler(c.marcar));
cenariosRoutes.get("/:id/resultados", autenticacao, ler, asyncHandler(c.resultados));
cenariosRoutes.get("/:id/indicadores", autenticacao, ler, asyncHandler(c.indicadores));
// A edição da DRE do cenário pela ferramenta (12/10/2026).
cenariosRoutes.get("/:id/edicao", autenticacao, editar, asyncHandler(c.edicao));
cenariosRoutes.put("/:id/edicao/valores", autenticacao, editar, express.json({ limit: "2mb" }), asyncHandler(c.gravarValores));
cenariosRoutes.get("/:id/reajustes", autenticacao, ler, asyncHandler(c.reajustes));
cenariosRoutes.post("/:id/referencia/realizado", autenticacao, editar, express.json(), asyncHandler(c.referenciaRealizado));
// O comparativo com outro cenário e as justificativas (12/10/2026).
cenariosRoutes.get("/:id/comparativo", autenticacao, ler, asyncHandler(c.comparativo));
cenariosRoutes.put("/:id/comparativo", autenticacao, editar, express.json(), asyncHandler(c.gravarComparativo));
cenariosRoutes.get("/:id/justificativas", autenticacao, ler, asyncHandler(c.justificativas));
cenariosRoutes.put("/:id/justificativas", autenticacao, editar, express.json(), asyncHandler(c.gravarJustificativa));
cenariosRoutes.put("/:id/indicadores/manuais", autenticacao, editar, express.json(), asyncHandler(c.salvarManual));
