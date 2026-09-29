import { readFile } from "node:fs/promises";

import { getPrismaClient } from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { ArquivoInvalidoError, lerAba } from "../../../lib/xlsx.js";
import { logger } from "../../../utils/logger.js";
import { caminhoDoArquivo } from "../arquivosImportados.js";
import { localizarCabecalho, normalizar, numero, texto } from "../listas/leituraListas.js";
import { garantirObras } from "../listas/obras.js";
import { escolherAba, recusarImportacao, registrarProgresso } from "../statusImportacao.js";

/**
 * Saldo inicial do estoque — a aba Estoque (2025) do SIG BPM 2026 - LISTAS
 * REALIZADO (OPERAÇÃO): o saldo de cada obra e linha no fim de 2025, em m³ e
 * em valor fiscal. Importado na competência de dezembro de 2025, vale como o
 * saldo final daquele mês, de onde parte a apuração de janeiro.
 *
 * Linhas repetidas da mesma obra e linha são somadas, como na planilha.
 */

const ABAS = ["Estoque (2025)"];
class ArquivoRecusado extends Error {}

export async function processarEstoqueInicial(importacaoId: string): Promise<void> {
  const prisma = getPrismaClient();
  try {
    const importacao = await prisma.importacao.findUniqueOrThrow({ where: { id: importacaoId } });
    const aba = lerAba(await readFile(caminhoDoArquivo(importacao.hashArquivo)), escolherAba(ABAS));
    await registrarProgresso(importacaoId, 30);

    const cab = localizarCabecalho(aba.linhas, ["OBRA", "LINHA", "VOLUME (M³)", "TOTAL FISCAL (R$)"], ["NOME DA OBRA"]);
    if ("erro" in cab) throw new ArquivoRecusado(cab.erro);
    const k = cab.col;
    const saldos = new Map<string, { obra: string; nome: string | null; linha: string; volume: Prisma.Decimal; valor: Prisma.Decimal }>();
    const rejeicoes: Array<{ linha: number; codigo: string; mensagem: string }> = [];
    let lidas = 0;
    let vazias = 0;
    for (const l of aba.linhas) {
      if (l.numero <= cab.numero) continue;
      lidas++;
      const obra = texto(l.celulas[k.OBRA]);
      if (!obra) {
        vazias++;
        continue;
      }
      const linha = normalizar(l.celulas[k.LINHA]);
      const volume = numero(l.celulas[k["VOLUME (M³)"]]);
      const valor = numero(l.celulas[k["TOTAL FISCAL (R$)"]]);
      if (!volume || !valor || !linha) {
        rejeicoes.push({ linha: l.numero, codigo: "VALOR_INVALIDO", mensagem: "Linha, volume ou valor inválido." });
        continue;
      }
      const chave = `${obra}|${linha}`;
      const s = saldos.get(chave) ?? { obra, nome: texto(l.celulas[k["NOME DA OBRA"]]), linha, volume: new Prisma.Decimal(0), valor: new Prisma.Decimal(0) };
      s.volume = s.volume.plus(volume);
      s.valor = s.valor.plus(valor);
      saldos.set(chave, s);
    }
    if (saldos.size === 0) throw new ArquivoRecusado(`A aba "${aba.nome}" não tem nenhum saldo.`);
    await registrarProgresso(importacaoId, 60);

    await prisma.$transaction(
      async (tx) => {
        const { porCodigo, criadas } = await garantirObras(tx, new Map([...saldos.values()].map((s) => [s.obra, s.nome])));
        const linhas = new Map((await tx.linha.findMany({ where: { tipo: "PRODUTO" }, select: { id: true, codigo: true } })).map((l) => [l.codigo, l.id]));
        await tx.estoqueSaldo.deleteMany({ where: { competenciaId: importacao.competenciaId } });
        await tx.estoqueSaldo.createMany({
          data: [...saldos.values()].map((s) => ({
            competenciaId: importacao.competenciaId,
            obraId: porCodigo.get(s.obra)!,
            linhaId: linhas.get(s.linha) ?? null,
            linhaTexto: s.linha,
            movimentoVolume: s.volume,
            movimentoValor: s.valor,
            saldoVolume: s.volume,
            saldoValor: s.valor,
            precoMedio: s.volume.isZero() ? new Prisma.Decimal(0) : s.valor.div(s.volume),
            importacaoId,
          })),
        });
        const porLinha = new Map<string, { saldos: number; volume: Prisma.Decimal; valor: Prisma.Decimal }>();
        for (const s of saldos.values()) {
          const t = porLinha.get(s.linha) ?? { saldos: 0, volume: new Prisma.Decimal(0), valor: new Prisma.Decimal(0) };
          porLinha.set(s.linha, { saldos: t.saldos + 1, volume: t.volume.plus(s.volume), valor: t.valor.plus(s.valor) });
        }
        await tx.importacao.update({
          where: { id: importacaoId },
          data: {
            status: "CONCLUIDA",
            progresso: 100,
            linhasLidas: lidas,
            linhasAceitas: lidas - vazias - rejeicoes.length,
            linhasRejeitadas: rejeicoes.length,
            linhasIgnoradas: vazias,
            relatorioErros: rejeicoes,
            resumo: {
              aba: aba.nome,
              saldos: saldos.size,
              obrasCriadas: criadas,
              porLinha: [...porLinha].map(([linha, t]) => ({ linha, saldos: t.saldos, volume: t.volume.toFixed(3), valor: t.valor.toFixed(2) })),
            },
          },
        });
      },
      { timeout: 120_000 },
    );
    logger("info", "Saldo inicial do estoque importado", { importacaoId, saldos: saldos.size });
  } catch (error) {
    if (error instanceof ArquivoRecusado || error instanceof ArquivoInvalidoError) {
      await recusarImportacao(importacaoId, error.message);
      return;
    }
    logger("error", "Falha ao processar o saldo inicial do estoque", { importacaoId, error: error instanceof Error ? error.message : String(error) });
    await recusarImportacao(importacaoId, "Erro inesperado no processamento. Nada foi gravado. Se persistir, encaminhe o arquivo ao responsável pelo sistema.");
  }
}
