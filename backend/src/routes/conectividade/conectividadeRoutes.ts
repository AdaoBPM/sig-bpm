import { Router } from "express";

import {
  autenticacaoDaApi,
  conectividadeController as c,
  pedidosPorUsuario,
  tokenPorEmail,
  tokenPorEndereco,
} from "../../controllers/conectividade/conectividadeController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/**
 * A API externa da Biblioteca de APIs (24/10/2026), montada em /v1 (no servidor do Next, /api/v1): o token, pelo login e
 * pela senha do SIG, e os dados, pelo token da API. As regras (HTTPS, a permissão, os bloqueios e a Auditoria) ficam no
 * serviço.
 */
export const apiExternaRoutes = Router();
apiExternaRoutes.post("/token", tokenPorEndereco, tokenPorEmail, asyncHandler(c.token));
apiExternaRoutes.get("/apis", asyncHandler(autenticacaoDaApi), pedidosPorUsuario, asyncHandler(c.catalogoDaApi));
apiExternaRoutes.get("/apis/:codigo", asyncHandler(autenticacaoDaApi), pedidosPorUsuario, asyncHandler(c.executar));

/** A tela APIs (Central de Conectividade), montada em /conectividade: Ler vê o catálogo, a prévia e os próprios acessos; Editar, os de todos e os bloqueios. */
export const conectividadeRoutes = Router();
const ler = verificarPermissao("biblioteca_apis:ler");
conectividadeRoutes.get("/catalogo", autenticacao, ler, asyncHandler(c.catalogo));
conectividadeRoutes.get("/previa/:codigo", autenticacao, ler, asyncHandler(c.previa));
conectividadeRoutes.get("/acessos", autenticacao, ler, asyncHandler(c.acessos));
conectividadeRoutes.put("/bloqueios", autenticacao, verificarPermissao("biblioteca_apis:editar"), asyncHandler(c.bloquear));
