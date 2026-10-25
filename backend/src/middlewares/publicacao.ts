import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import type { NextFunction, Request, Response } from "express";

/**
 * O modo de publicação (21/10/2026, combinado com o TI): com o arquivo-sinal `.publicacao-em-andamento` na pasta do banco
 * (no servidor, `/dados/.publicacao-em-andamento`, isto é, `/root/dados/sig-bpm/dados/` fora do container), a ferramenta
 * fica só para consulta: qualquer gravação (POST, PUT, PATCH e DELETE) é recusada com 503 e o aviso. O sinal fica fora do
 * código e do banco, então vale em qualquer versão e não se perde na troca dos containers. Quem liga e desliga: o
 * deploy.sh (o TI) e, antes de um script de dados no servidor, `touch` e `rm -f` no mesmo caminho.
 *
 * Continuam valendo: entrar no sistema, o registro do acesso às telas e as análises dos arquivos (as prévias, que não gravam).
 */
export const CODIGO_DA_PUBLICACAO = "PUBLICACAO_EM_ANDAMENTO";
export const AVISO_DA_PUBLICACAO = "Publicação em andamento: as telas continuam para consulta, mas criar, editar, apagar, importar e apurar ficam bloqueados até o fim (alguns minutos). Tente de novo em seguida.";

/**
 * O arquivo-sinal. Com o PostgreSQL (23/10/2026), o banco não é mais um arquivo: vale a PASTA_DO_SINAL do .env ou, sem
 * ela, a pasta /dados do container (a /root/dados/sig-bpm/dados do servidor, onde o deploy.sh liga e desliga o sinal).
 * Com um DATABASE_URL de arquivo (`file:`, o SQLite de antes), a pasta dele. Calculado na primeira consulta, depois de
 * os .env carregados.
 */
let sinal: string | null = null;
function pastaDoSinal() {
  if (process.env.PASTA_DO_SINAL) return resolve(process.env.PASTA_DO_SINAL);
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("file:") ? dirname(resolve(url.replace(/^file:/, ""))) : "/dados";
}
export const sinalDaPublicacao = () => (sinal ??= join(pastaDoSinal(), ".publicacao-em-andamento"));

export const emPublicacao = () => existsSync(sinalDaPublicacao());

const LIVRES: Array<(metodo: string, caminho: string) => boolean> = [
  (m, c) => m === "POST" && c === "/auth/login",
  // O token da Biblioteca de APIs (24/10/2026), como o login: só lê os dados.
  (m, c) => m === "POST" && c === "/v1/token",
  (m, c) => m === "POST" && c === "/auditoria/acesso",
  // As análises (prévias) das importações e dos arquivos dos cenários só leem o arquivo enviado.
  (m, c) => m === "POST" && /\/analise$/.test(c),
];

export function bloquearNaPublicacao(request: Request, response: Response, next: NextFunction) {
  const metodo = request.method.toUpperCase();
  if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return next();
  const caminho = request.path.replace(/\/+$/, "");
  if (LIVRES.some((livre) => livre(metodo, caminho)) || !emPublicacao()) return next();
  return response.status(503).json({ error: AVISO_DA_PUBLICACAO, codigo: CODIGO_DA_PUBLICACAO });
}
