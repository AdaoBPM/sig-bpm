import { readFile } from "node:fs/promises";

import { getPrismaClient } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { ArquivoInvalidoError, lerAba } from "../../../lib/xlsx.js";
import { logger } from "../../../utils/logger.js";
import { caminhoDoArquivo } from "../arquivosImportados.js";
import { SEM_REGISTROS_NO_MES } from "../listas/processarLista.js";
import { escolherAba, recusarImportacao, registrarProgresso } from "../statusImportacao.js";
import { ABA_LOTACAO, lerLotacao, type ItemLotacao, type LeituraLotacao } from "./leituraLotacao.js";

class ArquivoRecusado extends Error {}

/** O resumo da importação: a aba, os centros e os colaboradores do mês. */
export function resumoDaLotacao(aba: string, leitura: Extract<LeituraLotacao, { ok: true }>, extra: Record<string, unknown> = {}) {
  const soma = (k: "clt" | "pj" | "total") => leitura.itens.reduce((s, i) => s + i[k], 0);
  return { aba, centros: leitura.itens.length, clt: soma("clt"), pj: soma("pj"), total: soma("total"), zerados: leitura.zerados, foraDoMes: leitura.foraDoMes, ...extra };
}

/**
 * Grava a lista do mês na transação: apaga as linhas das importações anteriores do tipo (que ficam substituídas) e grava
 * as novas. A importação `importacaoId` já existe.
 */
export async function gravarLotacaoDoMes(tx: Prisma.TransactionClient, competenciaId: string, importacaoId: string, itens: ItemLotacao[], agora = new Date()) {
  const anteriores = (
    await tx.importacao.findMany({ where: { competenciaId, tipo: "QUADRO_LOTACAO", status: "CONCLUIDA", substituidaEm: null, id: { not: importacaoId } }, select: { id: true } })
  ).map((a) => a.id);
  if (anteriores.length) {
    await tx.lotacaoCentro.deleteMany({ where: { importacaoId: { in: anteriores } } });
    await tx.importacao.updateMany({ where: { id: { in: anteriores } }, data: { substituidaEm: agora } });
  }
  await tx.lotacaoCentro.createMany({ data: itens.map((i) => ({ competenciaId, importacaoId, ...i })) });
  return anteriores;
}

/**
 * Importa os colaboradores do mês por centro de custo (aba Quadro de Lotação do LISTAS REALIZADO (OPERAÇÃO)),
 * substituindo a importação anterior do mesmo tipo na competência. Não entra na apuração (importar não pede
 * reapuração) e não muda os indicadores de quadro de lotação, que seguem a aba Indicadores (Admin.).
 */
export async function processarLotacao(importacaoId: string): Promise<void> {
  const prisma = getPrismaClient();
  try {
    const importacao = await prisma.importacao.findUniqueOrThrow({
      where: { id: importacaoId },
      select: { hashArquivo: true, competenciaId: true, competencia: { select: { ano: true, mes: true } } },
    });
    const aba = lerAba(await readFile(caminhoDoArquivo(importacao.hashArquivo)), escolherAba([ABA_LOTACAO]));
    await registrarProgresso(importacaoId, 40);
    const { ano, mes } = importacao.competencia;
    const leitura = lerLotacao(aba.linhas, ano, mes);
    if (!leitura.ok) throw new ArquivoRecusado(leitura.motivo);
    if (leitura.itens.length === 0) throw new ArquivoRecusado(`A aba "${aba.nome}" ${SEM_REGISTROS_NO_MES} ${String(mes).padStart(2, "0")}/${ano}.`);
    await registrarProgresso(importacaoId, 60);

    const competenciaId = importacao.competenciaId;
    await prisma.$transaction(
      async (tx) => {
        const competencia = await tx.competencia.findUniqueOrThrow({ where: { id: competenciaId }, select: { status: true } });
        if (competencia.status === "FECHADA") throw new ArquivoRecusado("A competência foi fechada enquanto o arquivo era processado. Nada foi gravado.");
        await gravarLotacaoDoMes(tx, competenciaId, importacaoId, leitura.itens);
        await tx.importacao.update({
          where: { id: importacaoId },
          data: {
            status: "CONCLUIDA",
            progresso: 100,
            linhasLidas: leitura.itens.length + leitura.rejeicoes.length + leitura.zerados,
            linhasAceitas: leitura.itens.length,
            linhasRejeitadas: leitura.rejeicoes.length,
            linhasIgnoradas: leitura.zerados + leitura.foraDoMes,
            relatorioErros: leitura.rejeicoes,
            resumo: resumoDaLotacao(aba.nome, leitura),
          },
        });
      },
      { timeout: 120_000 },
    );
    logger("info", "Quadro de lotação importado", { importacaoId, centros: leitura.itens.length });
  } catch (error) {
    if (error instanceof ArquivoRecusado || error instanceof ArquivoInvalidoError) {
      await recusarImportacao(importacaoId, error.message);
      return;
    }
    logger("error", "Falha ao processar o quadro de lotação", { importacaoId, error: error instanceof Error ? error.message : String(error) });
    await recusarImportacao(importacaoId, "Erro inesperado no processamento. Nada foi gravado. Se persistir, encaminhe o arquivo ao responsável pelo sistema.");
  }
}
