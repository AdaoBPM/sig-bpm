// Carrega o .env do modo (.env.development ou .env.production) e o .env comum antes de qualquer leitura de
// process.env (15/10/2026; antes, só o .env). Sem isto, todas as variáveis caem no valor padrão — inclusive
// DATABASE_URL e JWT_SECRET.
import "./ambiente.js";

import { z } from "zod";

const WEAK_SECRETS = new Set([
  "altere-em-producao",
  "change-me",
  "secret",
  "jwt-secret",
  "use-uma-string-aleatoria-com-pelo-menos-32-caracteres", // o do .env.example
]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().default("altere-em-producao"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    REDIS_URL: z.string().optional(),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    MSSQL_SERVER: z.string().optional(),
    MSSQL_DATABASE: z.string().optional(),
    MSSQL_USER: z.string().optional(),
    MSSQL_PASSWORD: z.string().optional(),
    // "true"/"false", "1"/"0", "sim"... — z.coerce.boolean() tomaria "false" por verdadeiro.
    ENABLE_SWAGGER: z.stringbool().optional(),
    ENABLE_AUDIT: z.stringbool().optional(),
    /**
     * A Biblioteca de APIs sem HTTPS (24/10/2026): a regra do TI (Docs/projeto/anexos/RNF-API-SEGURA.md) só aceita o
     * token sobre HTTPS; sem esta variável, a produção recusa a API pedida por HTTP. Só o TI a liga (o arquivo .env).
     */
    API_ACEITA_HTTP: z.stringbool().optional(),
    TOTVS_WSDL_URL: z.string().optional(),
    TOTVS_USER: z.string().optional(),
    TOTVS_PASSWORD: z.string().optional(),
    /** Onde os arquivos importados ficam guardados, nomeados pelo hash. */
    UPLOAD_DIR: z.string().default("./uploads"),
    UPLOAD_MAX_MB: z.coerce.number().positive().default(50),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") return;

    if (WEAK_SECRETS.has(data.JWT_SECRET) || data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        message:
          "JWT_SECRET deve ter pelo menos 32 caracteres e não pode ser valor padrão em produção",
        path: ["JWT_SECRET"],
      });
    }
  });

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  enableSwagger: parsed.ENABLE_SWAGGER ?? parsed.NODE_ENV !== "production",
  enableAudit: parsed.ENABLE_AUDIT ?? true,
  apiAceitaHttp: parsed.API_ACEITA_HTTP ?? parsed.NODE_ENV !== "production",
  totvsConfigured: Boolean(parsed.TOTVS_WSDL_URL),
};
