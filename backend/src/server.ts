import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const server = app.listen(env.PORT, () => {
  logger("info", `Backend BPM rodando na porta ${env.PORT}`);
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
