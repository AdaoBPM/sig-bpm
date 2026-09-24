import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

import { env } from "./env.js";
import { openApiSpec } from "./openapi.js";

export function registerSwagger(app: Express) {
  if (!env.enableSwagger) {
    return;
  }

  app.get("/api/docs.json", (_request, response) => {
    response.json(openApiSpec);
  });

  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: "BPM API — Swagger",
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );
}
