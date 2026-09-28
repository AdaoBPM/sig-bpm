import { readFile } from "node:fs/promises";

import { getPrismaClient } from "../../../config/prisma.js";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { ArquivoInvalidoError, lerAba } from "../../../lib/xlsx.js";
import { logger } from "../../../utils/logger.js";
import { somarTotais, type ItemVolume } from "../../volumes/totaisOperacao.js";
import { caminhoDoArquivo } from "../arquivosImportados.js";
import { escolherAba, recusarImportacao, registrarProgresso } from "../statusImportacao.js";
import { DEFINICOES_LISTAS, ehListaRateio, type TipoListaRateio } from "./definicoesListas.js";
import type { RegistroLista } from "./leituraListas.js";
import { garantirObras } from "./obras.js";

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const LOTE_GRAVACAO = 500;

/** Recusa do arquivo inteiro: nada é gravado. */
class ArquivoRecusado extends Error {}

/** Campos comuns a toda lista operacional, na forma do createMany. */
export type LinhaGravada = {
  competenciaId: string;
  /** Nulo quando o registro foi digitado. */
  importacaoId: string | null;
  unidadeNegocioId: string | null;
  obraId: string | null;
  linhaId?: string | null;
  quantidade: Prisma.Decimal;
  criadoPor: string;
  linhaArquivo: number | null;
  /** Mais os campos próprios da lista (RegistroLista.campos). */
  [campo: string]: unknown;
};

/**
 * O Prisma não tem um delegate genérico: cada lista é um modelo. As duas
 * operações que a importação faz — apagar o lote anterior e gravar o novo —
 * ficam aqui, uma por modelo.
 */
async function apagarLotes(tx: Tx, tipo: TipoListaRateio, importacoes: string[]) {
  const where = { importacaoId: { in: importacoes } };
  switch (tipo) {
    case "PROJETO": return tx.projeto.deleteMany({ where });
    case "PRODUCAO": return tx.producao.deleteMany({ where });
    case "PRODUCAO_PISTA": return tx.producaoPista.deleteMany({ where });
    case "PRODUCAO_ARMADURA": return tx.producaoArmadura.deleteMany({ where });
    case "PRODUCAO_METALURGIA": return tx.producaoMetalurgia.deleteMany({ where });
    case "EXPEDICAO": return tx.expedicao.deleteMany({ where });
    case "MONTAGEM": return tx.montagem.deleteMany({ where });
    case "ACOMPANHAMENTO": return tx.acompanhamento.deleteMany({ where });
  }
}

export async function gravar(tx: Tx, tipo: TipoListaRateio, dados: LinhaGravada[]) {
  switch (tipo) {
    case "PROJETO": return tx.projeto.createMany({ data: dados as Prisma.ProjetoCreateManyInput[] });
    case "PRODUCAO": return tx.producao.createMany({ data: dados as Prisma.ProducaoCreateManyInput[] });
    case "PRODUCAO_PISTA": return tx.producaoPista.createMany({ data: dados as Prisma.ProducaoPistaCreateManyInput[] });
    case "PRODUCAO_ARMADURA": return tx.producaoArmadura.createMany({ data: dados as Prisma.ProducaoArmaduraCreateManyInput[] });
    case "PRODUCAO_METALURGIA": return tx.producaoMetalurgia.createMany({ data: dados as Prisma.ProducaoMetalurgiaCreateManyInput[] });
    case "EXPEDICAO": return tx.expedicao.createMany({ data: dados as Prisma.ExpedicaoCreateManyInput[] });
    case "MONTAGEM": return tx.montagem.createMany({ data: dados as Prisma.MontagemCreateManyInput[] });
    case "ACOMPANHAMENTO": return tx.acompanhamento.createMany({ data: dados as Prisma.AcompanhamentoCreateManyInput[] });
  }
}

/**
 * Registros lidos → linhas prontas para o createMany: resolve unidade, linha e
 * obra (cadastrando as obras novas). Serve à importação e à digitação.
 */
export async function prepararGravacao(
  tx: Tx,
  tipo: TipoListaRateio,
  registros: RegistroLista[],
  contexto: { competenciaId: string; importacaoId: string | null; criadoPor: string },
): Promise<{ dados: LinhaGravada[]; obrasCriadas: number }> {
  const [unidades, linhas] = await Promise.all([
    tx.unidadeNegocio.findMany({ select: { id: true, codigo: true } }),
    tx.linha.findMany({ select: { id: true, tipo: true, codigo: true } }),
  ]);
  const unidadePorCodigo = new Map(unidades.map((u) => [u.codigo, u.id]));
  const linhaPorChave = new Map(linhas.map((l) => [`${l.tipo}|${l.codigo}`, l.id]));
  const temLinha = tipo !== "PRODUCAO_METALURGIA";

  const obrasCitadas = new Map<string, string | null>();
  for (const r of registros) {
    if (r.obra && !obrasCitadas.has(r.obra.codigo)) obrasCitadas.set(r.obra.codigo, r.obra.nome);
  }
  const { porCodigo, criadas } = await garantirObras(tx, obrasCitadas);

  const dados = registros.map((r) => ({
    competenciaId: contexto.competenciaId,
    importacaoId: contexto.importacaoId,
    unidadeNegocioId: r.unidade ? (unidadePorCodigo.get(r.unidade) ?? null) : null,
    obraId: r.obra ? (porCodigo.get(r.obra.codigo) ?? null) : null,
    ...(temLinha
      ? { linhaId: r.linha ? (linhaPorChave.get(`${r.linha.tipo}|${r.linha.codigo}`) ?? null) : null }
      : {}),
    quantidade: r.quantidade,
    criadoPor: contexto.criadoPor,
    linhaArquivo: contexto.importacaoId ? r.linhaArquivo : null,
    ...r.campos,
  }));
  return { dados, obrasCriadas: criadas };
}

/** O que a regra dos Totais precisa de cada registro lido. */
export function itemDoRegistro(tipo: TipoListaRateio, r: RegistroLista): ItemVolume {
  return {
    tipo,
    quantidade: r.quantidade,
    unidade: r.unidade,
    linha: r.linha?.codigo ?? null,
    obraGlobal: r.obra?.codigo.toUpperCase().startsWith("G") ?? false,
    finalidade: (r.campos.finalidade as string | null | undefined) ?? null,
    categoria: (r.campos.categoria as string | null | undefined) ?? null,
    etapa: (r.campos.etapa as string | null | undefined) ?? null,
  };
}

export async function processarLista(importacaoId: string): Promise<void> {
  const prisma = getPrismaClient();

  try {
    const importacao = await prisma.importacao.findUniqueOrThrow({
      where: { id: importacaoId },
      include: { competencia: { select: { id: true, ano: true, mes: true } } },
    });
    const { competencia, tipo } = importacao;
    if (!ehListaRateio(tipo)) throw new Error(`Tipo ${tipo} não é lista operacional de rateio`);
    const def = DEFINICOES_LISTAS[tipo];
    const mesAno = `${String(competencia.mes).padStart(2, "0")}/${competencia.ano}`;

    const conteudo = await readFile(caminhoDoArquivo(importacao.hashArquivo));
    const aba = lerAba(conteudo, escolherAba(def.abas));
    await registrarProgresso(importacaoId, 30);

    const leitura = def.interpretar(aba.linhas, competencia.ano, competencia.mes);
    if (!leitura.ok) throw new ArquivoRecusado(leitura.motivo);
    const linhasIgnoradas = leitura.ignoradas.vazias + leitura.ignoradas.outrosMeses;
    if (leitura.registros.length === 0 && leitura.rejeicoes.length === 0) {
      await recusarImportacao(
        importacaoId,
        `A aba "${aba.nome}" não tem registros de ${mesAno}.`,
        { linhasLidas: leitura.linhasLidas, linhasIgnoradas },
      );
      return;
    }
    await registrarProgresso(importacaoId, 50);

    const totais = somarTotais(leitura.registros.map((r) => itemDoRegistro(tipo, r)), [tipo]);

    const { substituidas, obrasCriadas } = await prisma.$transaction(
      async (tx) => {
        const atual = await tx.competencia.findUniqueOrThrow({
          where: { id: competencia.id },
          select: { status: true },
        });
        if (atual.status === "FECHADA") {
          throw new ArquivoRecusado("A competência foi fechada enquanto o arquivo era processado. Nada foi gravado.");
        }

        const anteriores = await tx.importacao.findMany({
          where: { competenciaId: competencia.id, tipo, status: "CONCLUIDA", substituidaEm: null, id: { not: importacaoId } },
          select: { id: true },
        });
        const ids = anteriores.map((a) => a.id);
        if (ids.length > 0) {
          await apagarLotes(tx, tipo, ids);
          await tx.importacao.updateMany({ where: { id: { in: ids } }, data: { substituidaEm: new Date() } });
        }

        const { dados, obrasCriadas: criadas } = await prepararGravacao(tx, tipo, leitura.registros, {
          competenciaId: competencia.id,
          importacaoId,
          criadoPor: importacao.importadoPor,
        });
        for (let i = 0; i < dados.length; i += LOTE_GRAVACAO) {
          await gravar(tx, tipo, dados.slice(i, i + LOTE_GRAVACAO));
        }

        await tx.importacao.update({
          where: { id: importacaoId },
          data: {
            status: "CONCLUIDA",
            progresso: 100,
            linhasLidas: leitura.linhasLidas,
            linhasAceitas: leitura.registros.length,
            linhasRejeitadas: leitura.rejeicoes.length,
            linhasIgnoradas,
            relatorioErros: leitura.rejeicoes,
            resumo: {
              aba: aba.nome,
              lista: def.rotulo,
              registros: leitura.registros.length,
              ignoradas: leitura.ignoradas,
              totais: totais.map((t) => ({ ...t, quantidade: t.quantidade.toFixed(3) })),
              obrasCriadas: criadas,
              avisos: leitura.avisos,
              substituiu: ids,
            },
          },
        });
        return { substituidas: ids.length, obrasCriadas: criadas };
      },
      { timeout: 120_000 },
    );

    logger("info", "Lista operacional importada", {
      importacaoId,
      tipo,
      competencia: mesAno,
      registros: leitura.registros.length,
      rejeitadas: leitura.rejeicoes.length,
      obrasCriadas,
      substituidas,
    });
  } catch (error) {
    if (error instanceof ArquivoRecusado || error instanceof ArquivoInvalidoError) {
      await recusarImportacao(importacaoId, error.message);
      return;
    }
    logger("error", "Falha ao processar lista operacional", {
      importacaoId,
      error: error instanceof Error ? error.message : String(error),
    });
    await recusarImportacao(
      importacaoId,
      "Erro inesperado no processamento. Nada foi gravado. Se persistir, encaminhe o arquivo ao responsável pelo sistema.",
    );
  }
}
