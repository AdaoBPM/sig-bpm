import { config } from "dotenv";

/**
 * O ambiente (15/10/2026: a separação da produção e do desenvolvimento). Carrega primeiro o arquivo do modo —
 * `.env.development` ou `.env.production`, pelo NODE_ENV — e depois o `.env` comum (o segredo do JWT, os uploads…); o
 * que vem antes vale, porque o dotenv não sobrescreve. Sem NODE_ENV, é desenvolvimento: um comando esquecido cai no
 * banco de desenvolvimento, nunca no de produção. A produção entra com `node --env-file=.env.production` (o
 * NODE_ENV=production vem do próprio arquivo). O mesmo carregamento vale no prisma.config.ts (o Prisma CLI).
 */
export const MODO = process.env.NODE_ENV === "production" ? "production" : process.env.NODE_ENV === "test" ? "test" : "development";
config({ path: `.env.${MODO}`, quiet: true });
config({ quiet: true });
