import { Router } from "express";

import { authController } from "../controllers/authController.js";
import { autenticacao } from "../middlewares/autenticacao.js";
import { loginRateLimiter } from "../middlewares/loginRateLimiter.js";
import { validacao } from "../middlewares/validacao.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loginSchema } from "../schemas/auth/loginSchema.js";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  loginRateLimiter,
  validacao(loginSchema),
  asyncHandler(authController.login),
);
authRoutes.get("/me", autenticacao, asyncHandler(authController.me));
authRoutes.put("/senha", autenticacao, asyncHandler(authController.trocarSenha));
