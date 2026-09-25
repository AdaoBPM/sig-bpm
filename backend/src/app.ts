import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { registerSwagger } from "./config/swagger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { auditoriaRoutes } from "./routes/auditoriaRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { cadastrosRoutes } from "./routes/cadastros/cadastrosRoutes.js";
import { classificacaoRoutes } from "./routes/classificacao/classificacaoRoutes.js";
import { competenciasRoutes } from "./routes/competencias/competenciasRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import {
  importacoesDaCompetenciaRoutes,
  importacoesRoutes,
} from "./routes/importacoes/importacoesRoutes.js";

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: env.enableSwagger
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        }
      : undefined,
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

registerSwagger(app);

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/auditoria", auditoriaRoutes);
app.use("/cadastros", cadastrosRoutes);
app.use("/competencias/:anoMes/importacoes", importacoesDaCompetenciaRoutes);
app.use("/competencias/:anoMes/classificacao", classificacaoRoutes);
app.use("/competencias", competenciasRoutes);
app.use("/importacoes", importacoesRoutes);

app.use((_request, response) => {
  response.status(404).json({ error: "Rota não encontrada" });
});

app.use(errorHandler);
