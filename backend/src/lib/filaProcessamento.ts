import { logger } from "../utils/logger.js";

/**
 * Fila de processamento em memória, serial: uma tarefa por vez, na ordem de
 * chegada.
 *
 * Basta para a V1 — um único backend, 10 a 15 usuários, importações que levam
 * segundos — e mantém a importação fora do tempo de resposta da requisição. O
 * que ela não faz é sobreviver a um reinício: por isso o servidor, ao subir,
 * marca como interrompidas as importações que ficaram em PROCESSANDO. Uma fila
 * persistente (Redis) fica para quando houver mais de uma instância.
 */

let cadeia: Promise<void> = Promise.resolve();

export function enfileirar(descricao: string, tarefa: () => Promise<void>) {
  cadeia = cadeia.then(tarefa).catch((error: unknown) => {
    // A tarefa deve tratar os próprios erros; isto é a última rede.
    logger("error", `Falha não tratada na fila: ${descricao}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/** Resolve quando tudo o que está na fila terminou. Usado nos testes. */
export function aguardarFila(): Promise<void> {
  return cadeia;
}
