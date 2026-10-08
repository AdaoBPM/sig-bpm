import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";

import { getPrismaClient } from "../../config/prisma.js";
import type { TipoImportacao } from "../../generated/prisma/enums.js";
import { enfileirar } from "../../lib/filaProcessamento.js";
import { caminhoDoArquivo, diretorioUploads } from "./arquivosImportados.js";
import { processarBalancete } from "./balancete/processarBalancete.js";
import { processarDreComercial } from "./dreComercial/processarDreComercial.js";
import { processarEstoqueInicial } from "./estoqueInicial/processarEstoqueInicial.js";
import { DEFINICOES_LISTAS } from "./listas/definicoesListas.js";
import { DEFINICOES_LISTAS_RECEITA } from "./listas/definicoesListasReceita.js";
import { ehListaOperacional, processarLista } from "./listas/processarLista.js";
import { auditar } from "../auditoriaService.js";
import { ArquivoInvalidoError } from "../../lib/xlsx.js";
import { analisarArquivo, type AbaAnalisada } from "./analiseArquivo.js";

/**
 * Erro de regra da importação, com o status HTTP que o controller devolve.
 * `codigo` permite à tela reagir a um caso específico — o arquivo repetido
 * pede confirmação, os demais só mostram a mensagem.
 */
export class RegraImportacaoError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
    readonly codigo?: string,
    readonly detalhes?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Tipos com processamento implementado: o balancete, as listas que alimentam
 * os rateios, as que alimentam só a receita prévia, a DRE do Comercial e o
 * saldo inicial do estoque.
 */
const TIPOS_DISPONIVEIS: TipoImportacao[] = [
  "BALANCETE",
  "DRE_COMERCIAL",
  "ESTOQUE_INICIAL",
  ...(Object.keys(DEFINICOES_LISTAS) as TipoImportacao[]),
  ...(Object.keys(DEFINICOES_LISTAS_RECEITA) as TipoImportacao[]),
];

function rotulo(ano: number, mes: number) {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

async function competenciaPorAnoMes(ano: number, mes: number) {
  const competencia = await getPrismaClient().competencia.findUnique({
    where: { ano_mes: { ano, mes } },
    select: { id: true, ano: true, mes: true, status: true },
  });
  if (!competencia) {
    throw new RegraImportacaoError(
      404,
      `A competência ${rotulo(ano, mes)} não existe. Abra-a antes de importar.`,
    );
  }
  return competencia;
}

export type ReceberImportacaoInput = {
  ano: number;
  mes: number;
  tipo: TipoImportacao;
  nomeArquivo: string;
  conteudo: Buffer;
  usuarioId: string;
  /** Confirma a importação de um arquivo idêntico a um já importado. */
  forcar: boolean;
};

const CAMPOS_RESUMO = {
  id: true,
  tipo: true,
  nomeArquivo: true,
  importadoEm: true,
  status: true,
  progresso: true,
  linhasLidas: true,
  linhasAceitas: true,
  linhasRejeitadas: true,
  linhasIgnoradas: true,
  motivoRejeicao: true,
  substituidaEm: true,
  comparacao: true,
  usuario: { select: { nome: true } },
} as const;

export const importacoesService = {
  async receber(input: ReceberImportacaoInput) {
    const prisma = getPrismaClient();

    if (!TIPOS_DISPONIVEIS.includes(input.tipo)) {
      throw new RegraImportacaoError(
        400,
        `A importação do tipo ${input.tipo} ainda não está disponível.`,
      );
    }
    if (input.conteudo.length === 0) {
      throw new RegraImportacaoError(400, "O arquivo enviado está vazio.");
    }

    const competencia = await competenciaPorAnoMes(input.ano, input.mes);
    // Balancete de competência fechada (Passo 24): é recebido só para comparar
    // com o gravado; as diferenças viram divergências e nada é substituído.
    const comparacao = competencia.status === "FECHADA" && input.tipo === "BALANCETE";
    if (competencia.status === "FECHADA" && !comparacao) {
      throw new RegraImportacaoError(
        409,
        `A competência ${rotulo(input.ano, input.mes)} está fechada. ` +
          "Importar nela exige reabri-la.",
        "COMPETENCIA_FECHADA",
      );
    }

    const emAndamento = await prisma.importacao.findFirst({
      where: {
        competenciaId: competencia.id,
        tipo: input.tipo,
        status: "PROCESSANDO",
      },
      select: { id: true },
    });
    if (emAndamento) {
      throw new RegraImportacaoError(
        409,
        "Já há uma importação deste tipo em processamento nesta competência. " +
          "Aguarde ela terminar.",
        "IMPORTACAO_EM_ANDAMENTO",
        { importacaoId: emAndamento.id },
      );
    }

    // O hash identifica o arquivo repetido DENTRO da competência. O mesmo
    // arquivo do balancete traz o exercício inteiro e é legitimamente
    // importado em janeiro, em fevereiro e assim por diante.
    const hash = createHash("sha256").update(input.conteudo).digest("hex");
    if (!input.forcar && !comparacao) {
      const repetida = await prisma.importacao.findFirst({
        where: {
          competenciaId: competencia.id,
          tipo: input.tipo,
          hashArquivo: hash,
          status: "CONCLUIDA",
          substituidaEm: null,
        },
        select: CAMPOS_RESUMO,
      });
      if (repetida) {
        throw new RegraImportacaoError(
          409,
          `Este arquivo já foi importado nesta competência em ` +
            `${repetida.importadoEm.toLocaleString("pt-BR")}` +
            (repetida.usuario ? ` por ${repetida.usuario.nome}` : "") +
            (input.tipo === "DRE_COMERCIAL"
              ? ". Importar de novo não muda nenhum preço."
              : ". Importar de novo substitui o lote atual pelo mesmo conteúdo."),
          "ARQUIVO_JA_IMPORTADO",
          { importacao: repetida },
        );
      }
    }

    // O arquivo é guardado pelo hash: é a prova do que foi importado.
    await mkdir(diretorioUploads(), { recursive: true });
    const caminho = caminhoDoArquivo(hash);
    try {
      await access(caminho);
    } catch {
      await writeFile(caminho, input.conteudo);
    }

    const importacao = await prisma.importacao.create({
      data: {
        competenciaId: competencia.id,
        tipo: input.tipo,
        nomeArquivo: input.nomeArquivo,
        hashArquivo: hash,
        importadoPor: input.usuarioId,
        comparacao,
      },
      select: CAMPOS_RESUMO,
    });

    enfileirar(`importação ${importacao.id}`, async () => {
      try {
        await (ehListaOperacional(importacao.tipo)
          ? processarLista(importacao.id)
          : importacao.tipo === "DRE_COMERCIAL"
            ? processarDreComercial(importacao.id)
            : importacao.tipo === "ESTOQUE_INICIAL"
              ? processarEstoqueInicial(importacao.id)
              : processarBalancete(importacao.id));
      } finally {
        // Auditoria (Passo 23): o arquivo, o que ele substituiu e o resultado do processamento.
        const fim = await getPrismaClient().importacao.findUnique({
          where: { id: importacao.id },
          select: { status: true, linhasLidas: true, linhasAceitas: true, linhasRejeitadas: true, linhasIgnoradas: true, motivoRejeicao: true },
        });
        const substituida = await getPrismaClient().importacao.findFirst({
          where: { competenciaId: competencia.id, tipo: input.tipo, substituidaEm: { not: null }, id: { not: importacao.id } },
          orderBy: { substituidaEm: "desc" },
          select: { id: true, nomeArquivo: true, importadoEm: true },
        });
        await auditar({
          usuarioId: input.usuarioId,
          acao: "IMPORTACAO",
          entidade: "importacao",
          entidadeId: importacao.id,
          antes: fim?.status === "CONCLUIDA" && substituida ? { substituiu: substituida } : undefined,
          depois: fim,
          metadados: { competencia: rotulo(input.ano, input.mes), tipo: input.tipo, arquivo: input.nomeArquivo, hash, forcar: !!input.forcar },
        });
      }
    });

    return importacao;
  },

  /**
   * Importação em lote: lê o arquivo inteiro, associa cada aba a um tipo e
   * confere a estrutura (analisarArquivo); as abas prontas entram na fila, uma
   * por vez, como importações separadas. Uma aba com erro não impede as
   * outras. Arquivo idêntico ao já importado de um tipo não é reimportado.
   */
  async receberLote(input: Omit<ReceberImportacaoInput, "tipo" | "forcar"> & { alcanca: (tipo: TipoImportacao) => boolean }) {
    if (input.conteudo.length === 0) throw new RegraImportacaoError(400, "O arquivo enviado está vazio.");
    const competencia = await competenciaPorAnoMes(input.ano, input.mes);
    let analise: ReturnType<typeof analisarArquivo>;
    try {
      analise = analisarArquivo(input.conteudo, { ano: input.ano, mes: input.mes, fechada: competencia.status === "FECHADA" }, input.alcanca);
    } catch (error) {
      if (error instanceof ArquivoInvalidoError) throw new RegraImportacaoError(400, error.message);
      throw error;
    }
    type Resultado = AbaAnalisada & { importacaoId?: string; envio?: "NA_FILA" | "SEM_MUDANCA" | "ERRO" };
    const abas: Resultado[] = [];
    for (const a of analise.abas) {
      if (a.situacao !== "PRONTA") {
        abas.push(a);
        continue;
      }
      try {
        const imp = await this.receber({ ...input, tipo: a.tipo, forcar: false });
        abas.push({ ...a, envio: "NA_FILA", importacaoId: imp.id });
      } catch (error) {
        if (!(error instanceof RegraImportacaoError)) throw error;
        abas.push({
          ...a,
          envio: error.codigo === "ARQUIVO_JA_IMPORTADO" ? "SEM_MUDANCA" : "ERRO",
          mensagem: error.codigo === "ARQUIVO_JA_IMPORTADO" ? "Este arquivo já foi importado para este tipo; nada muda." : error.message,
        });
      }
    }
    return { nomeArquivo: input.nomeArquivo, abas, outras: analise.outras };
  },

  async listar(ano: number, mes: number) {
    const competencia = await competenciaPorAnoMes(ano, mes);
    const itens = await getPrismaClient().importacao.findMany({
      where: { competenciaId: competencia.id },
      orderBy: { importadoEm: "desc" },
      select: CAMPOS_RESUMO,
    });
    return { competencia, itens };
  },

  async detalhar(id: string) {
    const importacao = await getPrismaClient().importacao.findUnique({
      where: { id },
      select: {
        ...CAMPOS_RESUMO,
        hashArquivo: true,
        relatorioErros: true,
        resumo: true,
        competencia: { select: { ano: true, mes: true, status: true } },
      },
    });
    if (!importacao) {
      throw new RegraImportacaoError(404, "Importação não encontrada.");
    }
    return importacao;
  },

  /**
   * Ao subir o servidor: o que estava em PROCESSANDO foi interrompido pelo
   * reinício e nunca vai terminar. Marcar como recusado libera a competência
   * para uma nova importação — nada foi gravado, a gravação é transacional.
   */
  async recuperarInterrompidas() {
    const { count } = await getPrismaClient().importacao.updateMany({
      where: { status: "PROCESSANDO" },
      data: {
        status: "REJEITADA",
        progresso: 100,
        motivoRejeicao:
          "O processamento foi interrompido por um reinício do servidor. " +
          "Nada foi gravado; envie o arquivo de novo.",
      },
    });
    return count;
  },
};
