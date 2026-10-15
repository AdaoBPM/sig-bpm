// Copia o banco de produção para o de desenvolvimento (15/10/2026): os caminhos saem do DATABASE_URL de
// .env.production (a origem) e de .env.development (o destino). Lê a produção só para leitura (VACUUM INTO, uma cópia
// consistente mesmo com a produção no ar) e troca o arquivo de desenvolvimento no fim. O desenvolvimento precisa estar
// parado (o Windows não deixa trocar um arquivo aberto). Uso: npm run db:copiar-producao.
import { readFileSync, renameSync, rmSync } from "node:fs";
import Database from "better-sqlite3";
import { parse } from "dotenv";

const caminho = (arquivo) => {
  const url = parse(readFileSync(arquivo)).DATABASE_URL ?? "";
  if (!url.startsWith("file:")) throw new Error(`${arquivo}: o DATABASE_URL não é um arquivo SQLite (${url || "vazio"}).`);
  return url.slice(5);
};
const origem = caminho(".env.production");
const destino = caminho(".env.development");
if (origem === destino) throw new Error("A produção e o desenvolvimento apontam para o mesmo banco: confira os .env.");
const novo = `${destino}.novo`;
rmSync(novo, { force: true });
const db = new Database(origem, { readonly: true, fileMustExist: true });
db.exec(`VACUUM INTO '${novo.replace(/'/g, "''")}'`);
db.close();
try {
  rmSync(destino, { force: true });
} catch {
  rmSync(novo, { force: true });
  console.error(`Não foi possível trocar ${destino}: pare o desenvolvimento (npm run dev) e rode de novo.`);
  process.exit(1);
}
renameSync(novo, destino);
console.log(`Copiado: ${origem} → ${destino}`);
