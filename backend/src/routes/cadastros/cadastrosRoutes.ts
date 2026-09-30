import express, { Router } from "express";

import { env } from "../../config/env.js";
import { verificarPermissao } from "../../middlewares/verificarPermissao.js";

import { cadastrosController } from "../../controllers/cadastros/cadastrosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const cadastrosRoutes = Router();

// Consulta, e a recarga a partir da planilha durante o paralelo. A edição
// registro a registro entra no Passo 25.
cadastrosRoutes.get(
  "/resumo",
  autenticacao,
  verificarPermissao("cadastros:ler"),
  asyncHandler(cadastrosController.resumo),
);

// Recarga a partir da planilha, para o período de paralelo.
cadastrosRoutes.post(
  "/recarga/previa",
  autenticacao,
  verificarPermissao("cadastros:editar"),
  express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }),
  asyncHandler(cadastrosController.recargaPrevia),
);

cadastrosRoutes.post(
  "/recarga/confirmar",
  autenticacao,
  verificarPermissao("cadastros:editar"),
  asyncHandler(cadastrosController.recargaConfirmar),
);

cadastrosRoutes.get(
  "/centros-custo",
  autenticacao,
  verificarPermissao("cadastros:ler"),
  asyncHandler(cadastrosController.listarCentrosCusto),
);

cadastrosRoutes.get(
  "/contas-resultado",
  autenticacao,
  verificarPermissao("cadastros:ler"),
  asyncHandler(cadastrosController.listarContasResultado),
);

cadastrosRoutes.get(
  "/reclassificacoes",
  autenticacao,
  verificarPermissao("cadastros:ler"),
  asyncHandler(cadastrosController.listarReclassificacoes),
);

cadastrosRoutes.get(
  "/precos-contrato",
  autenticacao,
  verificarPermissao("cadastros:ler"),
  asyncHandler(cadastrosController.listarPrecosContrato),
);

cadastrosRoutes.get(
  "/linhas-dre",
  autenticacao,
  verificarPermissao("cadastros:ler"),
  asyncHandler(cadastrosController.listarLinhasDRE),
);
