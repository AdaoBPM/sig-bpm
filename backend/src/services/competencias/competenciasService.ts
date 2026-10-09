import { getPrismaClient } from "../../config/prisma.js";
import type { AbrirCompetenciaInput } from "../../schemas/competencias/abrirCompetenciaSchema.js";
import { auditar } from "../auditoriaService.js";
import { apuracaoService } from "../apuracao/apuracaoService.js";
import { TIPOS_FORA_DA_APURACAO } from "../importacoes/indicadores/leituraIndicadores.js";

/** Erro de regra de negócio — vira 409 no controller, não 500. */
export class RegraCompetenciaError extends Error {}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const competenciasService = {
  /** Com `andamento`, cada competência traz também o andamento das etapas (tela de competências). */
  async listar(ano?: number, andamento = false) {
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
            divergencias: { where: { status: "ABERTA" } },
            historicoReaberturas: true,
          },
        },
      },
    });

    const etapas = andamento ? await apuracaoService.andamento(competencias) : null;
    // Bola verde: o mês pede reapuração — entradas alteradas depois da apuração (a bola da etapa DRE), ou o mês
    // anterior reapurado depois dele —, ou recebeu dados importados a partir de outro mês (lote) e ainda não foi
    // apurado depois disso (também o que nunca foi apurado).
    const atrasadas = await apuracaoService.desatualizadas(competencias);
    const recebidas = await prisma.importacao.groupBy({
      by: ["competenciaId"],
      where: {
        competenciaId: { in: competencias.map((c) => c.id) },
        enviadaDe: { not: null },
        status: "CONCLUIDA",
        substituidaEm: null,
        tipo: { notIn: TIPOS_FORA_DA_APURACAO },
      },
      _max: { importadoEm: true },
    });
    const ultimaRecebida = new Map(recebidas.map((r) => [r.competenciaId, r._max.importadoEm]));
    const dadosNovos = (c: (typeof competencias)[number]) => {
      const em = ultimaRecebida.get(c.id);
      return atrasadas.has(c.id) || (!!em && (!c.apuradaEm || em > c.apuradaEm));
    };
    return competencias.map((c) => ({
      ...c,
      nomeMes: MESES[c.mes - 1],
      dadosNovos: dadosNovos(c),
      ...(etapas ? { andamento: etapas.get(c.id) } : {}),
    }));
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
