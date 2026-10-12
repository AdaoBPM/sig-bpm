import express, { Router } from "express";

import { env } from "../../config/env.js";
import { verificarAlgumaPermissao, verificarPermissao } from "../../middlewares/verificarPermissao.js";

import { cadastrosController } from "../../controllers/cadastros/cadastrosController.js";
import { autenticacao } from "../../middlewares/autenticacao.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const cadastrosRoutes = Router();

// Consulta, e a recarga a partir da planilha durante o paralelo. A edição
// registro a registro entra no Passo 25.
cadastrosRoutes.get(
  "/resumo",
  autenticacao,
  verificarAlgumaPermissao("cadastros_apuracao:ler", "cadastros_controladoria:ler"),
  asyncHandler(cadastrosController.resumo),
);

// Recarga a partir da planilha, para o período de paralelo (nas telas dos Cadastros da Controladoria).
cadastrosRoutes.post(
  "/recarga/previa",
  autenticacao,
  verificarPermissao("cadastros_controladoria:editar"),
  express.raw({ type: () => true, limit: `${env.UPLOAD_MAX_MB}mb` }),
  asyncHandler(cadastrosController.recargaPrevia),
);

cadastrosRoutes.post(
  "/recarga/confirmar",
  autenticacao,
  verificarPermissao("cadastros_controladoria:editar"),
  asyncHandler(cadastrosController.recargaConfirmar),
);

cadastrosRoutes.get(
  "/centros-custo",
  autenticacao,
  verificarPermissao("cadastros_controladoria:ler"),
  asyncHandler(cadastrosController.listarCentrosCusto),
);

cadastrosRoutes.get(
  "/contas-resultado",
  autenticacao,
  verificarPermissao("cadastros_controladoria:ler"),
  asyncHandler(cadastrosController.listarContasResultado),
);

cadastrosRoutes.get(
  "/reclassificacoes",
  autenticacao,
  verificarPermissao("cadastros_apuracao:ler"),
  asyncHandler(cadastrosController.listarReclassificacoes),
);

cadastrosRoutes.get(
  "/precos-contrato",
  autenticacao,
  verificarPermissao("cadastros_apuracao:ler"),
  asyncHandler(cadastrosController.listarPrecosContrato),
);

cadastrosRoutes.get(
  "/linhas-dre",
  autenticacao,
  verificarPermissao("cadastros_controladoria:ler"),
  asyncHandler(cadastrosController.listarLinhasDRE),
);
