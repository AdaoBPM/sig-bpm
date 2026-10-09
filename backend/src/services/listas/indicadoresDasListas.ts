import { getPrismaClient } from "../../config/prisma.js";
import { INDICADORES } from "../relatorios/indicadores.js";
import { RegraListaError } from "./listasService.js";

/**
 * As abas Comercial e Administrativo das Listas: os indicadores numerados do
 * grupo (os da aba Realizado (SIG) do INDICADORES DE RESULTADO), com o valor
 * do mês importado das abas Indicadores (Comercial) e Indicadores (Admin.).
 * Só leitura: os valores se corrigem no arquivo, reimportado em Importações.
 */
export const SETORES_INDICADORES = {
  comercial: { grupo: "Comercial", tipo: "INDICADORES_COMERCIAL" },
  administrativo: { grupo: "Administrativo", tipo: "INDICADORES_ADMIN" },
} as const;

export type SetorIndicadores = keyof typeof SETORES_INDICADORES;

export const ehSetorIndicadores = (s: string): s is SetorIndicadores => s in SETORES_INDICADORES;

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

export async function indicadoresDaLista(setor: SetorIndicadores, ano: number, mes: number) {
  const prisma = getPrismaClient();
  const { grupo, tipo } = SETORES_INDICADORES[setor];
  const competencia = await prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true, ano: true, mes: true, status: true } });
  if (!competencia) throw new RegraListaError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  const importacao = await prisma.importacao.findFirst({
    where: { competenciaId: competencia.id, tipo, status: "CONCLUIDA", substituidaEm: null },
    orderBy: { importadoEm: "desc" },
    select: { nomeArquivo: true, importadoEm: true, indicadores: { select: { nome: true, valor: true } } },
  });
  const valores = new Map((importacao?.indicadores ?? []).map((i) => [i.nome, Number(i.valor)]));
  return {
    competencia,
    importacao: importacao ? { nomeArquivo: importacao.nomeArquivo, importadoEm: importacao.importadoEm } : null,
    indicadores: INDICADORES.filter((i) => i.grupo === grupo && i.numero !== "").map((i) => ({
      numero: i.numero,
      nome: i.nome,
      unidade: i.unidade,
      metodologia: i.metodologia,
      valor: valores.get(i.nome) ?? null,
    })),
  };
}
