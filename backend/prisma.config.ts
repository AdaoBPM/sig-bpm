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
    path: "prisma/migrations",
  },
  datasource: {
    // Desenvolvimento: SQLite em arquivo, sem servidor.
    // Produção: PostgreSQL — ver prisma/PORTABILIDADE.md.
    // Sem o .env do modo, o de desenvolvimento (15/10/2026; antes, o dev.db, que é o banco de produção).
    url: process.env.DATABASE_URL ?? "file:./prisma/desenvolvimento.db",
  },
});
