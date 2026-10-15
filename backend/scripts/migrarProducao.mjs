// Aplica as migrações no banco de produção (15/10/2026): o mesmo `prisma migrate deploy`, com NODE_ENV=production
// (o prisma.config.ts lê então o .env.production). Sem este script, o Prisma CLI vai para o banco de desenvolvimento.
// Faça o back-up antes. Uso: npm run db:migrar-producao.
import { spawnSync } from "node:child_process";

const r = spawnSync("npx prisma migrate deploy", { stdio: "inherit", shell: true, env: { ...process.env, NODE_ENV: "production" } });
process.exit(r.status ?? 1);
