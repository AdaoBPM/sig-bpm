import { Router } from "express";

import { totvsService } from "../services/totvsService.js";

export const healthRoutes = Router();

healthRoutes.get("/", async (_request, response) => {
  const totvs = await totvsService.healthCheck();
  return response.json({
    data: {
      status: "ok",
      totvs,
    },
  });
});
