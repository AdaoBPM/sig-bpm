import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

// O adaptador do PostgreSQL (23/10/2026; antes, o do SQLite em arquivo): o DATABASE_URL é a URL postgresql:// do
// banco (sig_bpm_dev no desenvolvimento, sig_bpm na produção).

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  if (!env.DATABASE_URL) {
    return null;
  }

  // O esquema do banco (30/10/2026): o parâmetro schema da URL, como no `prisma migrate` (o teste usa o seu, com a cópia
  // da produção, no banco do desenvolvimento); sem ele, o public.
  const schema = new URL(env.DATABASE_URL).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL }, { schema });

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
