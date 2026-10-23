import { config } from "dotenv";

import { defineConfig } from "prisma/config";

// O mesmo carregamento do backend (src/config/ambiente.ts, 15/10/2026): o .env do modo e depois o comum. Sem NODE_ENV,
// desenvolvimento — o `prisma migrate` sem mais nada vai para o banco de desenvolvimento; para a produção, o script
// db:migrar-producao.
const modo = process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development";
config({ path: `.env.${modo}`, quiet: true });
config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // As do PostgreSQL, a partir da 0_init (23/10/2026); as do SQLite ficam em prisma/migrations-sqlite, só de histórico.
    path: "prisma/migrations",
  },
  datasource: {
    // PostgreSQL (23/10/2026): o DATABASE_URL do .env do modo, sem padrão (antes, o arquivo SQLite do desenvolvimento).
    // O banco-sombra (SHADOW_DATABASE_URL) é o do `prisma migrate dev`: descartável, só no desenvolvimento.
    url: process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
