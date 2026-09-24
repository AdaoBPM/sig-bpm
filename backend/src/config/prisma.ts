import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

// Adaptador de desenvolvimento: SQLite em arquivo.
// MIGRAÇÃO PARA POSTGRES: trocar por `PrismaPg` de "@prisma/adapter-pg"
// (já instalado, vem do molde) e usar `{ connectionString: env.DATABASE_URL }`.
// Ver prisma/PORTABILIDADE.md.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  if (!env.DATABASE_URL) {
    return null;
  }

  const adapter = new PrismaBetterSqlite3({
    url: env.DATABASE_URL,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error("DATABASE_URL não configurada");
  }
  return prisma;
}
