import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Desenvolvimento: SQLite em arquivo, sem servidor.
    // Produção: PostgreSQL — ver prisma/PORTABILIDADE.md.
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
});
