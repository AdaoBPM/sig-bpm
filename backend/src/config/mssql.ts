import { env } from "./env.js";

export type MssqlConfig = {
  server: string;
  database: string;
  user: string;
  password: string;
};

export function getMssqlConfig(): MssqlConfig | null {
  if (
    !env.MSSQL_SERVER ||
    !env.MSSQL_DATABASE ||
    !env.MSSQL_USER ||
    !env.MSSQL_PASSWORD
  ) {
    return null;
  }

  return {
    server: env.MSSQL_SERVER,
    database: env.MSSQL_DATABASE,
    user: env.MSSQL_USER,
    password: env.MSSQL_PASSWORD,
  };
}

// Stub: conectar via driver MSSQL quando integração TOTVS for implementada
export async function getMssqlPool() {
  const config = getMssqlConfig();
  if (!config) {
    throw new Error("MSSQL não configurado");
  }
  throw new Error("Integração MSSQL/TOTVS ainda não implementada");
}
