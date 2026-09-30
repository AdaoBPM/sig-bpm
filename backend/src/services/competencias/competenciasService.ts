import { getPrismaClient } from "../../config/prisma.js";
import type { AbrirCompetenciaInput } from "../../schemas/competencias/abrirCompetenciaSchema.js";
import { auditar } from "../auditoriaService.js";

/** Erro de regra de negócio — vira 409 no controller, não 500. */
export class RegraCompetenciaError extends Error {}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const competenciasService = {
  async listar(ano?: number) {
    const prisma = getPrismaClient();

    const competencias = await prisma.competencia.findMany({
      where: ano ? { ano } : {},
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
      select: {
        id: true,
        ano: true,
        mes: true,
        status: true,
        abertaEm: true,
        apuradaEm: true,
        apuracoes: true,
        fechadaEm: true,
        usuarioAbertura: { select: { nome: true } },
        usuarioApuracao: { select: { nome: true } },
        usuarioFechamento: { select: { nome: true } },
        _count: {
          select: {
            importacoes: true,
            divergencias: true,
            historicoReaberturas: true,
          },
        },
      },
    });

    return competencias.map((c) => ({ ...c, nomeMes: MESES[c.mes - 1] }));
  },

  async anosDisponiveis() {
    const prisma = getPrismaClient();
    const anos = await prisma.competencia.groupBy({
      by: ["ano"],
      orderBy: { ano: "desc" },
    });
    return anos.map((a) => a.ano);
  },

  async abrir(input: AbrirCompetenciaInput, usuarioId: string) {
    const prisma = getPrismaClient();

    const existente = await prisma.competencia.findUnique({
      where: { ano_mes: { ano: input.ano, mes: input.mes } },
    });
    if (existente) {
      throw new RegraCompetenciaError(
        `A competência ${String(input.mes).padStart(2, "0")}/${input.ano} já existe.`,
      );
    }

    const criada = await prisma.competencia.create({
      data: { ano: input.ano, mes: input.mes, abertaPor: usuarioId },
      select: { id: true, ano: true, mes: true, status: true, abertaEm: true },
    });

    await auditar({ usuarioId, acao: "ABERTURA", entidade: "competencia", entidadeId: criada.id, depois: criada, metadados: { competencia: `${String(criada.mes).padStart(2, "0")}/${criada.ano}` } });
    return { ...criada, nomeMes: MESES[criada.mes - 1] };
  },
};
