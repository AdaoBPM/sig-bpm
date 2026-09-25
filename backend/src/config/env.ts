// Carrega o backend/.env antes de qualquer leitura de process.env.
// Sem isto, o .env criado pelo `npm run setup` nunca chega a ser lido e todas
// as variáveis caem no valor padrão — inclusive DATABASE_URL e JWT_SECRET.
import "dotenv/config";

import { z } from "zod";

const WEAK_SECRETS = new Set(["altere-em-producao", "change-me", "secret", "jwt-secret"]);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().default("altere-em-producao"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    REDIS_URL: z.string().optional(),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
    ENABLE_TEMPLATE_AUTH: z.coerce.boolean().optional(),
    MSSQL_SERVER: z.string().optional(),
    MSSQL_DATABASE: z.string().optional(),
    MSSQL_USER: z.string().optional(),
    MSSQL_PASSWORD: z.string().optional(),
    ENABLE_SWAGGER: z.coerce.boolean().optional(),
    ENABLE_AUDIT: z.coerce.boolean().optional(),
    TOTVS_WSDL_URL: z.string().optional(),
    TOTVS_USER: z.string().optional(),
    TOTVS_PASSWORD: z.string().optional(),
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
  enableTemplateAuth:
    parsed.ENABLE_TEMPLATE_AUTH ?? parsed.NODE_ENV === "development",
  enableSwagger: parsed.ENABLE_SWAGGER ?? parsed.NODE_ENV !== "production",
  enableAudit: parsed.ENABLE_AUDIT ?? true,
  totvsConfigured: Boolean(parsed.TOTVS_WSDL_URL),
};
