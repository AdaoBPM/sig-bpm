import { Router } from "express";

import { realizadoObraController as c } from "../../controllers/realizadoObra/realizadoObraController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * O Realizado por Obra (03/11/2026): montado em /realizado-por-obra. A venda é de cada usuário: quem lê os Resultados escolhe
 * a sua na lista Venda. O Painel de Bordo saiu em 03/11/2026 (pedido do Adão), até os Resultados Vendidos e a busca no RM.
 */
export const realizadoObraRoutes = Router();

const resultados = verificarPermissao("realizado_obra_resultados:ler");
realizadoObraRoutes.get("/vendas", autenticacao, resultados, asyncHandler(c.vendas));
realizadoObraRoutes.put("/venda", autenticacao, resultados, asyncHandler(c.escolher));
realizadoObraRoutes.get("/resultados", autenticacao, resultados, asyncHandler(c.resultados));
realizadoObraRoutes.get("/memoria", autenticacao, resultados, asyncHandler(c.memoria));
