import { readFile } from "node:fs/promises";

import { getPrismaClient } from "../../../config/prisma.js";
import { ArquivoInvalidoError, lerAba } from "../../../lib/xlsx.js";
import { logger } from "../../../utils/logger.js";
import { caminhoDoArquivo } from "../arquivosImportados.js";
import { escolherAba, recusarImportacao, registrarProgresso } from "../statusImportacao.js";
import { DEFINICOES_DOCUMENTOS, lerDocumentos, type TipoDocumentos } from "./leituraDocumentos.js";

class ArquivoRecusado extends Error {}
const LOTE = 500;

/**
 * Importa os itens do mês das requisições ou das notas fiscais (abas Requisições (Lista) e Notas Fiscais (Lista) do
 * LISTAS REALIZADO (RESULTADOS)), substituindo a importação anterior do mesmo tipo na competência. Desde 26/10/2026, a
 * tarefa dos itens leva os custos às linhas na etapa Linhas da apuração: importar depois de apurar pede reapuração (o
 * retrato das entradas), e a competência fechada não recebe documentos.
 */
export async function processarDocumentos(importacaoId: string): Promise<void> {
  const prisma = getPrismaClient();
  try {
    const importacao = await prisma.importacao.findUniqueOrThrow({
      where: { id: importacaoId },
      select: { tipo: true, hashArquivo: true, competenciaId: true, competencia: { select: { ano: true, mes: true } } },
    });
    const tipo = importacao.tipo as TipoDocumentos;
    const def = DEFINICOES_DOCUMENTOS[tipo];
    const aba = lerAba(await readFile(caminhoDoArquivo(importacao.hashArquivo)), escolherAba([def.aba]));
    await registrarProgresso(importacaoId, 40);
    const { ano, mes } = importacao.competencia;
    const leitura = tipo === "REQUISICOES" ? lerDocumentos("REQUISICOES", aba.linhas, ano, mes) : lerDocumentos("NOTAS_FISCAIS", aba.linhas, ano, mes);
    if (!leitura.ok) throw new ArquivoRecusado(leitura.motivo);
    if (leitura.itens.length === 0) throw new ArquivoRecusado(`A aba "${aba.nome}" não tem nenhum item do mês.`);
    await registrarProgresso(importacaoId, 60);

    const competenciaId = importacao.competenciaId;
    await prisma.$transaction(
      async (tx) => {
        const competencia = await tx.competencia.findUniqueOrThrow({ where: { id: competenciaId }, select: { status: true } });
        if (competencia.status === "FECHADA") throw new ArquivoRecusado("A competência foi fechada enquanto o arquivo era processado. Nada foi gravado.");
        const anteriores = (
          await tx.importacao.findMany({ where: { competenciaId, tipo, status: "CONCLUIDA", substituidaEm: null, id: { not: importacaoId } }, select: { id: true } })
        ).map((a) => a.id);
        const base = { competenciaId, importacaoId };
        if (tipo === "REQUISICOES") {
          if (anteriores.length) await tx.requisicaoItem.deleteMany({ where: { importacaoId: { in: anteriores } } });
          const itens = leitura.itens.map((i) => ({ ...base, ...i }));
          for (let k = 0; k < itens.length; k += LOTE) await tx.requisicaoItem.createMany({ data: itens.slice(k, k + LOTE) as never });
        } else {
          if (anteriores.length) await tx.notaFiscalItem.deleteMany({ where: { importacaoId: { in: anteriores } } });
          const itens = leitura.itens.map((i) => ({ ...base, ...i }));
          for (let k = 0; k < itens.length; k += LOTE) await tx.notaFiscalItem.createMany({ data: itens.slice(k, k + LOTE) as never });
        }
        if (anteriores.length) await tx.importacao.updateMany({ where: { id: { in: anteriores } }, data: { substituidaEm: new Date() } });
        const total = leitura.itens.reduce((s, i) => s + Number(i.valorTotal), 0);
        await tx.importacao.update({
          where: { id: importacaoId },
          data: {
            status: "CONCLUIDA",
            progresso: 100,
            linhasLidas: leitura.itens.length + leitura.rejeicoes.length,
            linhasAceitas: leitura.itens.length,
            linhasRejeitadas: leitura.rejeicoes.length,
            linhasIgnoradas: leitura.foraDoMes,
            relatorioErros: leitura.rejeicoes,
            resumo: { aba: aba.nome, itens: leitura.itens.length, contas: new Set(leitura.itens.map((i) => i.contaContabil)).size, total: total.toFixed(2), foraDoMes: leitura.foraDoMes },
          },
        });
      },
      { timeout: 120_000 },
    );
    logger("info", "Documentos importados", { importacaoId, tipo, itens: leitura.itens.length });
  } catch (error) {
    if (error instanceof ArquivoRecusado || error instanceof ArquivoInvalidoError) {
      await recusarImportacao(importacaoId, error.message);
      return;
    }
    logger("error", "Falha ao processar os documentos", { importacaoId, error: error instanceof Error ? error.message : String(error) });
    await recusarImportacao(importacaoId, "Erro inesperado no processamento. Nada foi gravado. Se persistir, encaminhe o arquivo ao responsável pelo sistema.");
  }
}
