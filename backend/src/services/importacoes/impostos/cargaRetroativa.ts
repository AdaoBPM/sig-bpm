import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";

import { getPrismaClient } from "../../../config/prisma.js";
import { lerAba } from "../../../lib/xlsx.js";
import { auditar } from "../../auditoriaService.js";
import { caminhoDoArquivo, diretorioUploads } from "../arquivosImportados.js";
import { ABA_CREDITOS, lerCreditos } from "./leituraCreditos.js";
import { comAsContas, gravarCreditosDoMes, resumoDosCreditos } from "./processarCreditos.js";

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

export type CargaDoMes = {
  competencia: string;
  status: string;
  situacao: "CARREGADO" | "SIMULADO" | "RECUSADO";
  motivo?: string;
  contas: number;
  creditado: number;
  estornado: number;
  /** As linhas da aba recusadas no mês (a conta desconhecida, o valor inválido…), que não se gravam. */
  recusadas: string[];
  /** As linhas do mês de outras contas da Estrutura da DRE (nem Matérias Primas nem Gastos Gerais Variáveis da Produção nem o Frete). */
  ignoradas: string[];
  /** A importação dos créditos que a carga substituiu, quando havia. */
  substituiu: number;
};

/**
 * A carga retroativa da aba Impostos (Lista) (04/11/2026) nos meses já fechados, sem reabri-los: a importação comum recusa
 * competência fechada. Para cada mês, lê a aba e, com `gravar`, grava os créditos numa transação com uma importação CONCLUIDA
 * (resumo.modo CARGA_RETROATIVA), substituindo a anterior do tipo. O estado da competência e a apuração não mudam (os créditos
 * não entram na DRE apurada). O arquivo fica guardado pelo hash, como os importados: a próxima importação em lote o compara
 * pelo conteúdo.
 */
export async function carregarCreditosRetroativos(opcoes: {
  conteudo: Uint8Array;
  nomeArquivo: string;
  ano: number;
  meses: number[];
  usuario: { id: string; nome: string };
  gravar: boolean;
}): Promise<CargaDoMes[]> {
  const prisma = getPrismaClient();
  const aba = lerAba(opcoes.conteudo, (abas) => abas.find((a) => a.normalize("NFC").trim().toLowerCase() === ABA_CREDITOS.normalize("NFC").toLowerCase()) ?? null);
  const hash = createHash("sha256").update(opcoes.conteudo).digest("hex");
  if (opcoes.gravar) {
    await mkdir(diretorioUploads(), { recursive: true });
    try {
      await access(caminhoDoArquivo(hash));
    } catch {
      await writeFile(caminhoDoArquivo(hash), opcoes.conteudo);
    }
  }
  const resultados: CargaDoMes[] = [];
  for (const mes of opcoes.meses) {
    const competencia = await prisma.competencia.findUnique({ where: { ano_mes: { ano: opcoes.ano, mes } }, select: { id: true, status: true } });
    const base = { competencia: rotulo(opcoes.ano, mes), status: competencia?.status ?? "—", contas: 0, creditado: 0, estornado: 0, recusadas: [], ignoradas: [], substituiu: 0 };
    if (!competencia) {
      resultados.push({ ...base, situacao: "RECUSADO", motivo: "a competência não existe" });
      continue;
    }
    const leitura = lerCreditos(aba.linhas, opcoes.ano, mes);
    if (!leitura.ok) {
      resultados.push({ ...base, situacao: "RECUSADO", motivo: leitura.motivo });
      continue;
    }
    const { creditos, ignoradas, rejeicoes } = await comAsContas(leitura.itens);
    if (!creditos.length) {
      resultados.push({ ...base, situacao: "RECUSADO", motivo: "a aba não tem créditos do mês nas contas de Matérias Primas e de Gastos Gerais Variáveis da Produção nem no Frete e Descarga" });
      continue;
    }
    const todas = [...leitura.rejeicoes, ...rejeicoes];
    const resumo = resumoDosCreditos(aba.nome, leitura, creditos, ignoradas);
    const anteriores = await prisma.importacao.count({ where: { competenciaId: competencia.id, tipo: "CREDITOS_IMPOSTOS", status: "CONCLUIDA", substituidaEm: null } });
    resultados.push({
      ...base,
      situacao: opcoes.gravar ? "CARREGADO" : "SIMULADO",
      contas: resumo.contas,
      creditado: resumo.creditado,
      estornado: resumo.estornado,
      recusadas: todas.map((r) => `linha ${r.linha}: ${r.mensagem}`),
      ignoradas: ignoradas.map((i) => `linha ${i.linhaArquivo}: ${i.atribuicao} › ${i.conta}`),
      substituiu: anteriores,
    });
    if (!opcoes.gravar) continue;

    await prisma.$transaction(
      async (tx) => {
        const importacao = await tx.importacao.create({
          data: {
            competenciaId: competencia.id,
            tipo: "CREDITOS_IMPOSTOS",
            nomeArquivo: opcoes.nomeArquivo,
            hashArquivo: hash,
            importadoPor: opcoes.usuario.id,
            status: "CONCLUIDA",
            progresso: 100,
            linhasLidas: leitura.itens.length + leitura.rejeicoes.length,
            linhasAceitas: creditos.length,
            linhasRejeitadas: todas.length,
            linhasIgnoradas: leitura.foraDoMes,
            relatorioErros: todas,
            resumo: resumoDosCreditos(aba.nome, leitura, creditos, ignoradas, { modo: "CARGA_RETROATIVA", statusDaCompetencia: competencia.status }),
          },
          select: { id: true },
        });
        await gravarCreditosDoMes(tx, competencia.id, importacao.id, creditos);
      },
      { timeout: 120_000 },
    );
    await auditar({
      usuarioId: opcoes.usuario.id,
      usuarioNome: opcoes.usuario.nome,
      acao: "IMPORTACAO",
      entidade: "competencia",
      entidadeId: `${opcoes.ano}-${String(mes).padStart(2, "0")}`,
      metadados: { creditosDeImpostos: "carga retroativa, sem reabrir nem recalcular", arquivo: opcoes.nomeArquivo, status: competencia.status, contas: resumo.contas },
    });
  }
  return resultados;
}
