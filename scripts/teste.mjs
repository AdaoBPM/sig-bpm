// O ambiente de teste (21/10/2026): a versão compilada da ferramenta (sem o Turbopack, as telas abrem em menos de 1 s)
// com o banco do desenvolvimento (o DATABASE_URL do backend/.env.teste; na branch postgres, o sig_bpm_dev). Telas na porta
// 3200, backend na 3201.
// Uso (na pasta sig-bpm):
//   npm run teste:construir   gera a versão de teste do código de agora (o backend em backend/dist, as telas em frontend/.next)
//   npm run teste             inicia o teste a partir do que foi gerado
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(raiz, "backend");
const frontend = join(raiz, "frontend");
const PORTA = 3200;
const PORTA_DO_BACKEND = 3201;

/** Roda um comando com o prefixo do nome em cada linha; devolve o processo. */
function rodar(nome, comando, pasta, env = {}) {
  const p = spawn(comando, { cwd: pasta, shell: true, env: { ...process.env, ...env } });
  const prefixar = (saida) => (dados) => {
    for (const linha of String(dados).split(/\r?\n/)) if (linha.trim()) saida.write(`[${nome}] ${linha}\n`);
  };
  p.stdout.on("data", prefixar(process.stdout));
  p.stderr.on("data", prefixar(process.stderr));
  return p;
}
const esperar = (p) => new Promise((ok, erro) => p.on("exit", (codigo) => (codigo === 0 ? ok() : erro(new Error(`saiu com o código ${codigo}`)))));

if (process.argv[2] === "construir") {
  // A etiqueta "Teste" e o cookie próprio entram nas telas na compilação (NEXT_PUBLIC_AMBIENTE).
  await esperar(rodar("backend", "npm run build", backend));
  await esperar(rodar("frontend", "npx next build --turbopack", frontend, { NEXT_PUBLIC_AMBIENTE: "teste" }));
  console.log(`Versão de teste gerada. Inicie com: npm run teste (http://localhost:${PORTA})`);
} else {
  if (!existsSync(join(backend, ".env.teste"))) {
    console.error("Falta o backend/.env.teste (veja Docs/PRODUCAO-E-DESENVOLVIMENTO.md).");
    process.exit(1);
  }
  // O backend lê o .env.teste (a porta 3201 e o banco do desenvolvimento) antes do .env do modo e do comum.
  const b = rodar("backend", "node --env-file=.env.teste dist/server.js", backend);
  // As telas falam com o backend do teste (o BACKEND_URL do ambiente vale mais que o dos arquivos .env).
  const f = rodar("frontend", `npx next start -p ${PORTA}`, frontend, { BACKEND_URL: `http://localhost:${PORTA_DO_BACKEND}` });
  const parar = () => {
    for (const p of [b, f]) if (p.exitCode === null) p.kill();
  };
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
  // Se um dos dois cai, o outro também para (como o concurrently -k da produção antiga).
  for (const p of [b, f]) p.on("exit", (codigo) => { parar(); process.exitCode = codigo ?? 1; });
}
