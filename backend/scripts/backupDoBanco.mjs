// O back-up do banco de produção (15/10/2026; desde 23/10/2026, PostgreSQL): o pg_dump no formato próprio (custom),
// uma cópia consistente mesmo com a produção no ar, na pasta pedida. O banco sai do DATABASE_URL do .env.production —
// nunca do de desenvolvimento. O pg_dump precisa ser da versão do servidor (15) ou mais nova: o do PATH ou o do PG_DUMP.
// Para voltar: pg_restore --clean --if-exists --no-owner --dbname=<url> <arquivo>.
// Uso: npm run db:backup -- "C:/caminho/da/pasta"
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";

const pasta = process.argv[2];
if (!pasta) {
  console.error('Informe a pasta: npm run db:backup -- "C:/caminho/da/pasta"');
  process.exit(1);
}
const url = parse(readFileSync(".env.production")).DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//.test(url)) throw new Error(".env.production: o DATABASE_URL não é um banco PostgreSQL.");
mkdirSync(pasta, { recursive: true });
const destino = join(pasta, "sig_bpm.dump");
if (existsSync(destino)) throw new Error(`${destino} já existe: escolha outra pasta.`);
const r = spawnSync(process.env.PG_DUMP ?? "pg_dump", ["--format=custom", "--no-owner", `--file=${destino}`, `--dbname=${url}`], { stdio: "inherit" });
if (r.error) throw new Error(`Não foi possível rodar o pg_dump (${r.error.message}): instale o cliente do PostgreSQL ou informe o caminho em PG_DUMP.`);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`Back-up do banco de produção em ${destino}`);
