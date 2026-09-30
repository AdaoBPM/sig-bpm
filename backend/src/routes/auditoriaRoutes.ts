import { Router } from "express";

import { auditoriaController } from "../controllers/auditoriaController.js";
import { autenticacao } from "../middlewares/autenticacao.js";
import { validacao } from "../middlewares/validacao.js";
import { verificarPermissao } from "../middlewares/verificarPermissao.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registrarAcessoSchema } from "../schemas/auditoria/registrarAcessoSchema.js";

/**
 * Log de auditoria (Passo 23). Só leitura: não há rota que altere ou apague
 * registro — o log é imutável (e o banco também recusa).
 */
export const auditoriaRoutes = Router();

auditoriaRoutes.post("/acesso", autenticacao, validacao(registrarAcessoSchema), asyncHandler(auditoriaController.registrarAcesso));
auditoriaRoutes.get("/", autenticacao, verificarPermissao("auditoria:ler"), asyncHandler(auditoriaController.consultar));
auditoriaRoutes.get("/opcoes", autenticacao, verificarPermissao("auditoria:ler"), asyncHandler(auditoriaController.opcoes));
