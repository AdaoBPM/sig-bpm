import { getPrismaClient } from "../../config/prisma.js";
import type { ListarCadastroInput, ListarPrecosInput } from "../../schemas/cadastros/listarCadastroSchema.js";

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
            { codigoRM: { contains: busca, mode: "insensitive" as const } },
            { nomeRM: { contains: busca, mode: "insensitive" as const } },
            { nomeControladoria: { contains: busca, mode: "insensitive" as const } },
            { departamento: { contains: busca, mode: "insensitive" as const } },
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
            { reduzido: { contains: busca, mode: "insensitive" as const } },
            { conta: { contains: busca, mode: "insensitive" as const } },
            { descricao: { contains: busca, mode: "insensitive" as const } },
            { departamento: { contains: busca, mode: "insensitive" as const } },
            { atribuicao: { contains: busca, mode: "insensitive" as const } },
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
          ativo: true,
          linhaDRE: { select: { codigo: true, descricao: true } },
        },
      }),
      prisma.contaResultado.count({ where }),
    ]);

    return { itens, total, pagina: input.pagina, porPagina: input.porPagina };
  },

  /**
   * Reclassificações de conta por centro de custo. O centro é guardado pelo
   * código do RM, sem relação no banco; o nome é buscado à parte para a tela.
   */
  async listarReclassificacoes(input: ListarCadastroInput) {
    const prisma = getPrismaClient();
    const busca = input.busca?.trim();

    const where = busca
      ? {
          OR: [
            { codigoCentroCusto: { contains: busca, mode: "insensitive" as const } },
            { contaOrigem: { reduzido: { contains: busca, mode: "insensitive" as const } } },
            { contaOrigem: { descricao: { contains: busca, mode: "insensitive" as const } } },
            { contaDestino: { reduzido: { contains: busca, mode: "insensitive" as const } } },
            { contaDestino: { descricao: { contains: busca, mode: "insensitive" as const } } },
          ],
        }
      : {};

    const conta = {
      select: { reduzido: true, descricao: true, departamento: true, atribuicao: true },
    } as const;

    const [itens, total] = await Promise.all([
      prisma.reclassificacaoConta.findMany({
        where,
        orderBy: [{ codigoCentroCusto: "asc" }, { ordem: "asc" }],
        ...paginacao(input),
        select: {
          id: true,
          codigoCentroCusto: true,
          motivo: true,
          ativo: true,
          contaOrigem: conta,
          contaDestino: conta,
        },
      }),
      prisma.reclassificacaoConta.count({ where }),
    ]);

    const centros = await prisma.centroCusto.findMany({
      where: { codigoRM: { in: [...new Set(itens.map((i) => i.codigoCentroCusto))] } },
      select: { codigoRM: true, nomeRM: true, departamento: true, atribuicao: true },
    });
    const centroPorCodigo = new Map(centros.map((c) => [c.codigoRM, c]));

    return {
      itens: itens.map((i) => ({ ...i, centro: centroPorCodigo.get(i.codigoCentroCusto) ?? null })),
      total,
      pagina: input.pagina,
      porPagina: input.porPagina,
    };
  },

  /**
   * Preços do contrato, da DRE do Comercial. Com histórico, cada preço
   * substituído aparece logo abaixo do que o substituiu (mesma chave).
   */
  async listarPrecosContrato(input: ListarPrecosInput) {
    const prisma = getPrismaClient();
    const busca = input.busca?.trim();

    const where = {
      ...(input.historico ? {} : { substituidoEm: null }),
      ...(busca
        ? {
            OR: [
              { obra: { codigo: { contains: busca, mode: "insensitive" as const } } },
              { obra: { nome: { contains: busca, mode: "insensitive" as const } } },
              { contaResultado: { contains: busca, mode: "insensitive" as const } },
              { linhaTexto: { contains: busca, mode: "insensitive" as const } },
              { atribuicao: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [itens, total, substituidos] = await Promise.all([
      prisma.precoContrato.findMany({
        where,
        orderBy: [{ obra: { codigo: "asc" } }, { versao: "asc" }, { chave: "asc" }, { vigenteDesde: "desc" }],
        ...paginacao(input),
        select: {
          id: true,
          versao: true,
          etapa: true,
          linhaTexto: true,
          contaResultado: true,
          departamento: true,
          atribuicao: true,
          unidade: true,
          fornecimento: true,
          valorUnitario: true,
          valorTotal: true,
          percentualRL: true,
          vigenteDesde: true,
          substituidoEm: true,
          obra: { select: { codigo: true, nome: true, situacaoCadastro: true } },
        },
      }),
      prisma.precoContrato.count({ where }),
      prisma.precoContrato.count({ where: { substituidoEm: { not: null } } }),
    ]);

    return { itens, total, substituidos, pagina: input.pagina, porPagina: input.porPagina };
  },

  async listarLinhasDRE(input: ListarCadastroInput) {
    const prisma = getPrismaClient();
    const busca = input.busca?.trim();

    const where = busca
      ? {
          OR: [
            { codigo: { contains: busca, mode: "insensitive" as const } },
            { descricao: { contains: busca, mode: "insensitive" as const } },
            { grupo: { contains: busca, mode: "insensitive" as const } },
            { atribuicao: { contains: busca, mode: "insensitive" as const } },
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
          ativo: true,
          unidades: {
            select: { unidadeNegocio: { select: { nome: true } } },
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
