import express, { Router } from "express";

import { env } from "../../config/env.js";
import { cenariosController as c } from "../../controllers/cenarios/cenariosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao, verificarPermissaoDoCenario } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * Criação de Cenários (os sintéticos e os analíticos): montado em /cenarios. A permissão é a do tipo do cenário
 * (13/10/2026): Cenários Sintéticos (cenarios:*) ou Cenários Analíticos (cenarios_analiticos:*) — pelo cenário da rota,
 * ou, na lista e na criação, pelo tipo pedido.
 */
export const cenariosRoutes = Router();
const ler = verificarPermissaoDoCenario("ler");
const editar = verificarPermissaoDoCenario("editar");
// A importação de arquivo é só dos sintéticos.
const editarSinteticos = verificarPermissao("cenarios:editar");
cenariosRoutes.get("/", autenticacao, ler, asyncHandler(c.listar));
cenariosRoutes.post("/", autenticacao, express.json(), editar, asyncHandler(c.criar));
cenariosRoutes.post("/importar/analise", autenticacao, editarSinteticos, express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }), asyncHandler(c.analisar));
cenariosRoutes.post("/importar", autenticacao, editarSinteticos, express.json(), asyncHandler(c.importar));
cenariosRoutes.get("/:id", autenticacao, ler, asyncHandler(c.obter));
cenariosRoutes.patch("/:id", autenticacao, editar, express.json(), asyncHandler(c.atualizar));
cenariosRoutes.delete("/:id", autenticacao, editar, asyncHandler(c.excluir));
cenariosRoutes.put("/:id/marcacao", autenticacao, editar, express.json(), asyncHandler(c.marcar));
cenariosRoutes.get("/:id/resultados", autenticacao, ler, asyncHandler(c.resultados));
cenariosRoutes.get("/:id/indicadores", autenticacao, ler, asyncHandler(c.indicadores));
cenariosRoutes.get("/:id/painel", autenticacao, ler, asyncHandler(c.painel));
// A edição da DRE do cenário pela ferramenta (12/10/2026).
cenariosRoutes.get("/:id/edicao", autenticacao, editar, asyncHandler(c.edicao));
cenariosRoutes.put("/:id/edicao/valores", autenticacao, editar, express.json({ limit: "2mb" }), asyncHandler(c.gravarValores));
cenariosRoutes.get("/:id/reajustes", autenticacao, ler, asyncHandler(c.reajustes));
cenariosRoutes.post("/:id/referencia/realizado", autenticacao, editar, express.json(), asyncHandler(c.referenciaRealizado));
// O versionamento (13/10/2026): Congelar Versão, Reabrir Versão e Criar Revisão.
cenariosRoutes.post("/:id/versao", autenticacao, editar, asyncHandler(c.congelarVersao));
cenariosRoutes.post("/:id/versao/reabrir", autenticacao, editar, asyncHandler(c.reabrirVersao));
cenariosRoutes.post("/:id/revisao", autenticacao, editar, asyncHandler(c.criarRevisao));
// O comparativo com outro cenário e as justificativas (12/10/2026).
cenariosRoutes.get("/:id/comparativo", autenticacao, ler, asyncHandler(c.comparativo));
cenariosRoutes.put("/:id/comparativo", autenticacao, editar, express.json(), asyncHandler(c.gravarComparativo));
cenariosRoutes.get("/:id/justificativas", autenticacao, ler, asyncHandler(c.justificativas));
cenariosRoutes.put("/:id/justificativas", autenticacao, editar, express.json(), asyncHandler(c.gravarJustificativa));
// As premissas dos cenários analíticos (13/10/2026).
cenariosRoutes.get("/:id/premissas", autenticacao, ler, asyncHandler(c.premissas));
cenariosRoutes.put("/:id/premissas", autenticacao, editar, express.json({ limit: "2mb" }), asyncHandler(c.gravarPremissas));
// Os centros de custo dos cenários analíticos (13/10/2026).
cenariosRoutes.get("/:id/centros", autenticacao, ler, asyncHandler(c.centros));
cenariosRoutes.get("/:id/centros/contas", autenticacao, ler, asyncHandler(c.centro));
cenariosRoutes.put("/:id/centros", autenticacao, editar, express.json({ limit: "2mb" }), asyncHandler(c.gravarCentro));
cenariosRoutes.get("/:id/rateios", autenticacao, ler, asyncHandler(c.rateios));
cenariosRoutes.put("/:id/indicadores/manuais", autenticacao, editar, express.json(), asyncHandler(c.salvarManual));
