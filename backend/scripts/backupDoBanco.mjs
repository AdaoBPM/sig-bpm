// O back-up do banco de produção (15/10/2026): uma cópia consistente (VACUUM INTO), mesmo com a produção no ar, na
// pasta pedida. O banco sai do DATABASE_URL do .env.production — nunca do de desenvolvimento.
// Uso: npm run db:backup -- "C:/caminho/da/pasta"
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { parse } from "dotenv";

const pasta = process.argv[2];
if (!pasta) {
  console.error('Informe a pasta: npm run db:backup -- "C:/caminho/da/pasta"');
  process.exit(1);
}
const url = parse(readFileSync(".env.production")).DATABASE_URL ?? "";
if (!url.startsWith("file:")) throw new Error(`.env.production: o DATABASE_URL não é um arquivo SQLite (${url || "vazio"}).`);
mkdirSync(pasta, { recursive: true });
const destino = join(pasta, "dev.db");
if (existsSync(destino)) throw new Error(`${destino} já existe: escolha outra pasta.`);
const db = new Database(url.slice(5), { readonly: true, fileMustExist: true });
db.exec(`VACUUM INTO '${destino.split("\\").join("/").replace(/'/g, "''")}'`);
db.close();
console.log(`Back-up do banco de produção em ${destino}`);
