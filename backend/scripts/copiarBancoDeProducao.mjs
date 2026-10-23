// Copia o banco de produção para o de desenvolvimento (15/10/2026; desde 23/10/2026, PostgreSQL): as URLs saem do
// DATABASE_URL de .env.production (a origem) e de .env.development (o destino). Lê a produção só para leitura (pg_dump,
// uma cópia consistente mesmo com a produção no ar) e recria o desenvolvimento com o pg_restore (--clean: apaga e
// recria as tabelas, os dados e os gatilhos). O desenvolvimento precisa estar parado. O pg_dump e o pg_restore precisam
// ser da versão do servidor (15) ou mais nova: os do PATH ou os de PG_DUMP e PG_RESTORE. Na rotina combinada com o TI,
// quem recopia o sig_bpm_dev é o TI, pelo servidor. Uso: npm run db:copiar-producao.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "dotenv";

const urlDe = (arquivo) => {
  const url = parse(readFileSync(arquivo)).DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error(`${arquivo}: o DATABASE_URL não é um banco PostgreSQL.`);
  return url;
};
// O banco de uma URL (sem a senha), para a mensagem e a comparação.
const banco = (url) => {
  const u = new URL(url);
  return `${u.hostname}:${u.port || 5432}${u.pathname}`;
};
const origem = urlDe(".env.production");
const destino = urlDe(".env.development");
if (banco(origem) === banco(destino)) throw new Error("A produção e o desenvolvimento apontam para o mesmo banco: confira os .env.");
const arquivo = join(tmpdir(), `sig-bpm-copia-${Date.now()}.dump`);
const rodar = (programa, padrao, args) => {
  const r = spawnSync(process.env[programa] ?? padrao, args, { stdio: "inherit" });
  if (r.error) throw new Error(`Não foi possível rodar o ${padrao} (${r.error.message}): instale o cliente do PostgreSQL ou informe o caminho em ${programa}.`);
  return r.status ?? 1;
};
try {
  if (rodar("PG_DUMP", "pg_dump", ["--format=custom", "--no-owner", `--file=${arquivo}`, `--dbname=${origem}`]) !== 0) process.exit(1);
  if (rodar("PG_RESTORE", "pg_restore", ["--clean", "--if-exists", "--no-owner", "--single-transaction", `--dbname=${destino}`, arquivo]) !== 0) process.exit(1);
  console.log(`Copiado: ${banco(origem)} → ${banco(destino)}`);
} finally {
  rmSync(arquivo, { force: true });
}
