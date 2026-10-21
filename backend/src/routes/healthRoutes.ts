import { Router } from "express";

import { emPublicacao } from "../middlewares/publicacao.js";
import { totvsService } from "../services/totvsService.js";

export const healthRoutes = Router();

healthRoutes.get("/", async (_request, response) => {
  const totvs = await totvsService.healthCheck();
  return response.json({
    data: {
      status: "ok",
      // O modo de publicação (21/10/2026): a faixa das telas lê daqui.
      publicacao: emPublicacao(),
      totvs,
    },
  });
});
