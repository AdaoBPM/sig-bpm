import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";

import { getPrismaClient } from "../../config/prisma.js";
import { ArquivoInvalidoError } from "../../lib/xlsx.js";
import { logger } from "../../utils/logger.js";
import { classificacaoService } from "../classificacao/classificacaoService.js";
import { caminhoDoArquivo, diretorioUploads } from "../importacoes/arquivosImportados.js";
import { ajustesPrevistos } from "./carga/ajustesCarga.js";
import { compararComBanco, gravarCadastros, type Diferencas } from "./carga/aplicarCarga.js";
import { lerPlanilhaCadastros } from "./carga/planilhaCadastros.js";
import { prepararCadastros } from "./carga/prepararCadastros.js";
import { gravarTabelasReceita, lerTabelasReceita } from "./carga/tabelasReceita.js";

/**
 * Recarga dos cadastros a partir do SIG BPM 2026 - UNIDADES E CENTROS DE CUSTO,
 * para o período de paralelo, enquanto a planilha ainda é a referência.
 *
 * Em dois tempos: a prévia lê o arquivo e mostra o que muda; a confirmação
 * grava e reclassifica as competências abertas. Sai de cena quando o cadastro
 * passar a ser mantido na ferramenta (Passo 25).
 */

export class RecargaInvalida extends Error {}

/** Na tela, cada seção mostra até este tanto de mudanças; o resto vira contagem. */
const MAX_POR_SECAO = 100;

function resumir(d: Diferencas) {
  const cortar = <T>(l: T[]) => l.slice(0, MAX_POR_SECAO);
  return {
    contagem: { novos: d.novos.length, alterados: d.alterados.length, removidos: d.removidos.length, mantidos: d.mantidos.length, iguais: d.iguais },
    novos: cortar(d.novos),
    alterados: cortar(d.alterados),
    removidos: cortar(d.removidos),
    mantidos: cortar(d.mantidos),
  };
}

function preparar(conteudo: Uint8Array) {
  try {
    return prepararCadastros(lerPlanilhaCadastros(conteudo));
  } catch (error) {
    if (error instanceof ArquivoInvalidoError) throw new RecargaInvalida(error.message);
    throw error;
  }
}

export const recargaCadastrosService = {
  async previa(conteudo: Buffer) {
    if (conteudo.length === 0) throw new RecargaInvalida("O arquivo enviado está vazio.");
    const preparado = preparar(conteudo);
    const diferencas = await compararComBanco(preparado);

    // Guarda o arquivo pelo hash: a confirmação grava exatamente o que foi mostrado.
    const hash = createHash("sha256").update(conteudo).digest("hex");
    await mkdir(diretorioUploads(), { recursive: true });
    try {
      await access(caminhoDoArquivo(hash));
    } catch {
      await writeFile(caminhoDoArquivo(hash), conteudo);
    }

    const obsoletos = ajustesPrevistos().filter((a) => !preparado.ajustesUsados.has(a.chave));
    return {
      hash,
      centros: resumir(diferencas.centros),
      contas: resumir(diferencas.contas),
      dre: resumir(diferencas.dre),
      semDestino: preparado.semDestino,
      avisos: preparado.avisos,
      ajustesObsoletos: obsoletos.map((o) => o.descricao),
    };
  },

  async confirmar(hash: string, usuarioId: string) {
    let conteudo: Buffer;
    try {
      conteudo = await readFile(caminhoDoArquivo(hash));
    } catch {
      throw new RecargaInvalida("A prévia expirou ou o arquivo não foi encontrado. Envie a planilha de novo.");
    }
    const preparado = preparar(conteudo);
    const prisma = getPrismaClient();
    const tabelas = lerTabelasReceita(conteudo);
    const gravado = await prisma.$transaction(
      async (tx) => {
        const g = await gravarCadastros(tx, preparado);
        // Tipos de movimento e tabela de estacas vêm do mesmo arquivo e são
        // gravados como estão, sem prévia: são tabelas pequenas de consulta.
        await gravarTabelasReceita(tx, tabelas);
        return g;
      },
      { timeout: 120_000 },
    );

    // Corrigir o cadastro reclassifica as competências abertas (RF006). As
    // fechadas ficam como estão: lá a classificação está congelada.
    const abertas = await prisma.competencia.findMany({
      where: { status: { not: "FECHADA" } },
      select: { id: true, ano: true, mes: true },
      orderBy: [{ ano: "asc" }, { mes: "asc" }],
    });
    const reclassificadas: string[] = [];
    for (const c of abertas) {
      await classificacaoService.classificarCompetencia(c.id);
      reclassificadas.push(`${String(c.mes).padStart(2, "0")}/${c.ano}`);
    }

    logger("info", "Cadastros recarregados da planilha", { usuarioId, hash, ...gravado, reclassificadas });
    return { ...gravado, reclassificadas };
  },
};
