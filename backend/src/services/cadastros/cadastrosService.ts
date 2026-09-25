import { getPrismaClient } from "../../config/prisma.js";
import type { ListarCadastroInput } from "../../schemas/cadastros/listarCadastroSchema.js";

type Pagina<T> = {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
};

function paginacao({ pagina, porPagina }: ListarCadastroInput) {
  return { skip: (pagina - 1) * porPagina, take: porPagina };
}

/**
 * Leitura dos cadastros de parametrização.
 *
 * Somente leitura por enquanto: o Passo 8 existe para conferir a carga pela
 * tela. A edição entra no Passo 25, junto com as permissões.
 */
export const cadastrosService = {
  async listarCentrosCusto(input: ListarCadastroInput) {
    const prisma = getPrismaClient();
    const busca = input.busca?.trim();

    const where = busca
      ? {
          OR: [
            { codigoRM: { contains: busca } },
            { nomeRM: { contains: busca } },
            { nomeControladoria: { contains: busca } },
            { departamento: { contains: busca } },
          ],
        }
      : {};

    const [itens, total] = await Promise.all([
      prisma.centroCusto.findMany({
        where,
        orderBy: [{ ordem: "asc" }],
        ...paginacao(input),
        select: {
          id: true,
          codigoRM: true,
          nomeRM: true,
          nomeControladoria: true,
          departamento: true,
          departamentoSigla: true,
          atribuicao: true,
          atribuicaoSigla: true,
          balde: true,
          ativo: true,
        },
      }),
      prisma.centroCusto.count({ where }),
    ]);

    return { itens, total, pagina: input.pagina, porPagina: input.porPagina };
  },

  async listarContasResultado(input: ListarCadastroInput) {
    const prisma = getPrismaClient();
    const busca = input.busca?.trim();

    const where = busca
      ? {
          OR: [
            { reduzido: { contains: busca } },
            { conta: { contains: busca } },
            { descricao: { contains: busca } },
            { departamento: { contains: busca } },
            { atribuicao: { contains: busca } },
          ],
        }
      : {};

    const [itens, total] = await Promise.all([
      prisma.contaResultado.findMany({
        where,
        orderBy: [{ ordem: "asc" }],
        ...paginacao(input),
        select: {
          id: true,
          reduzido: true,
          conta: true,
          descricao: true,
          tipoConta: true,
          departamento: true,
          atribuicao: true,
          balde: true,
          sinalBalancete: true,
          ativo: true,
          linhaDRE: { select: { codigo: true, descricao: true } },
        },
      }),
      prisma.contaResultado.count({ where }),
    ]);

    return { itens, total, pagina: input.pagina, porPagina: input.porPagina };
  },

  async listarLinhasDRE(input: ListarCadastroInput) {
    const prisma = getPrismaClient();
    const busca = input.busca?.trim();

    const where = busca
      ? {
          OR: [
            { codigo: { contains: busca } },
            { descricao: { contains: busca } },
            { grupo: { contains: busca } },
            { atribuicao: { contains: busca } },
          ],
        }
      : {};

    const [itens, total] = await Promise.all([
      prisma.linhaDRE.findMany({
        where,
        orderBy: [{ ordem: "asc" }],
        ...paginacao(input),
        select: {
          id: true,
          codigo: true,
          ordem: true,
          grupo: true,
          grupoSigla: true,
          atribuicao: true,
          atribuicaoSigla: true,
          descricao: true,
          tipo: true,
          expressao: true,
          definicao: true,
          unidades: {
            select: { unidadeNegocio: { select: { nome: true, tipo: true } } },
          },
          _count: { select: { contas: true } },
        },
      }),
      prisma.linhaDRE.count({ where }),
    ]);

    return { itens, total, pagina: input.pagina, porPagina: input.porPagina };
  },

  /** Números de conferência da carga, para o cabeçalho das telas. */
  async resumo() {
    const prisma = getPrismaClient();
    const [
      unidades,
      centrosCusto,
      contas,
      contasVinculadas,
      linhas,
    ] = await Promise.all([
      prisma.unidadeNegocio.count(),
      prisma.centroCusto.count(),
      prisma.contaResultado.count(),
      prisma.contaResultado.count({ where: { linhaDREId: { not: null } } }),
      prisma.linhaDRE.count(),
    ]);

    return { unidades, centrosCusto, contas, contasVinculadas, linhas };
  },
};

export type { Pagina };
