import { app } from "./app.js";
import { env } from "./config/env.js";
import { importacoesService } from "./services/importacoes/importacoesService.js";
import { logger } from "./utils/logger.js";

const server = app.listen(env.PORT, () => {
  logger("info", `Backend BPM rodando na porta ${env.PORT}`);
  importacoesService
    .recuperarInterrompidas()
    .then((n) => {
      if (n > 0) logger("warn", `${n} importação(ões) interrompida(s) marcada(s) como recusada(s)`);
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
