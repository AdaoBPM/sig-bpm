import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { LINHAS_POR_UNIDADE, type LancamentoReceitaInput } from "../../schemas/receitaPrevia/receitaPreviaSchemas.js";
import { competenciaPorAnoMes, RegraReceitaError } from "./receitaPreviaService.js";

/**
 * Lançamentos manuais de receita — o que a aba Receita (Lanç. Manuais) do BASE
 * PRÉVIAS digitava: correções da prévia contra o contábil, redistribuições por
 * volume, inventário. Entram na receita na próxima apuração do mês.
 */

const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;

function exigirAberta(c: { ano: number; mes: number; status: string }) {
  if (c.status === "FECHADA") {
    throw new RegraReceitaError(409, `A competência ${rotulo(c.ano, c.mes)} está fechada. Lançar nela exige reabri-la.`);
  }
}

const SELECAO = {
  id: true,
  natureza: true,
  componente: true,
  valor: true,
  observacao: true,
  criadoEm: true,
  atualizadoEm: true,
  unidadeNegocio: { select: { codigo: true, nome: true } },
} as const;

function apresentar(l: {
  id: string;
  natureza: string;
  componente: string;
  valor: Prisma.Decimal;
  observacao: string;
  criadoEm: Date;
  atualizadoEm: Date;
  unidadeNegocio: { codigo: number; nome: string };
}) {
  return { ...l, unidade: l.unidadeNegocio.codigo, unidadeNome: l.unidadeNegocio.nome, valor: l.valor.toFixed(2) };
}

async function unidadeId(codigo: number) {
  const u = await getPrismaClient().unidadeNegocio.findUnique({ where: { codigo }, select: { id: true } });
  if (!u) throw new RegraReceitaError(400, `Unidade ${codigo} não cadastrada.`);
  return u.id;
}

async function doLancamento(id: string) {
  const l = await getPrismaClient().lancamentoReceita.findUnique({
    where: { id },
    select: { competencia: { select: { ano: true, mes: true, status: true } } },
  });
  if (!l) throw new RegraReceitaError(404, "Lançamento não encontrado.");
  exigirAberta(l.competencia);
}

export const lancamentosReceitaService = {
  opcoes() {
    return { linhasPorUnidade: LINHAS_POR_UNIDADE };
  },

  async listar(ano: number, mes: number) {
    const c = await competenciaPorAnoMes(ano, mes);
    const itens = await getPrismaClient().lancamentoReceita.findMany({
      where: { competenciaId: c.id },
      orderBy: [{ unidadeNegocio: { codigo: "asc" } }, { natureza: "asc" }, { criadoEm: "asc" }],
      select: SELECAO,
    });
    return { competencia: { ano, mes, status: c.status }, itens: itens.map(apresentar) };
  },

  async criar(ano: number, mes: number, input: LancamentoReceitaInput, usuarioId: string) {
    const c = await competenciaPorAnoMes(ano, mes);
    exigirAberta(c);
    const l = await getPrismaClient().lancamentoReceita.create({
      data: {
        competenciaId: c.id,
        unidadeNegocioId: await unidadeId(input.unidade),
        natureza: input.natureza,
        componente: input.componente,
        valor: new Prisma.Decimal(input.valor),
        observacao: input.observacao,
        criadoPor: usuarioId,
      },
      select: SELECAO,
    });
    return apresentar(l);
  },

  async atualizar(id: string, input: LancamentoReceitaInput) {
    await doLancamento(id);
    const l = await getPrismaClient().lancamentoReceita.update({
      where: { id },
      data: {
        unidadeNegocioId: await unidadeId(input.unidade),
        natureza: input.natureza,
        componente: input.componente,
        valor: new Prisma.Decimal(input.valor),
        observacao: input.observacao,
      },
      select: SELECAO,
    });
    return apresentar(l);
  },

  async excluir(id: string) {
    await doLancamento(id);
    await getPrismaClient().lancamentoReceita.delete({ where: { id } });
  },
};
