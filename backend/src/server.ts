import { app } from "./app.js";
import { env } from "./config/env.js";
import { importacoesService } from "./services/importacoes/importacoesService.js";
import { logger } from "./utils/logger.js";
import { plural } from "./utils/plural.js";

const server = app.listen(env.PORT, () => {
  logger("info", `Backend BPM rodando na porta ${env.PORT}`);
  importacoesService
    .recuperarInterrompidas()
    .then((n) => {
      if (n > 0) logger("warn", `${n} ${plural(n, "importação interrompida marcada como recusada", "importações interrompidas marcadas como recusadas")}`);
    })
    .catch((error: unknown) => {
      logger("error", "Falha ao recuperar importações interrompidas", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  if (env.enableSwagger) {
    logger("info", `Swagger UI: http://localhost:${env.PORT}/api/docs`);
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    logger("error", `Porta ${env.PORT} em uso — encerre o processo anterior ou altere PORT no .env`);
    process.exit(1);
  }
  throw error;
});
