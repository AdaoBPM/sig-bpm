import { join, resolve } from "node:path";

import { env } from "../../config/env.js";

/**
 * Os arquivos importados ficam guardados pelo hash do conteúdo: é a prova do
 * que entrou em cada lote, e o mesmo arquivo enviado duas vezes ocupa um só.
 */
export function diretorioUploads(): string {
  return resolve(env.UPLOAD_DIR);
}

export function caminhoDoArquivo(hash: string): string {
  return join(diretorioUploads(), `${hash}.xlsx`);
}
