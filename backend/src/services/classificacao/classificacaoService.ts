import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ValidacaoLancamento } from "../../generated/prisma/enums.js";
import { lancamentosManuaisService } from "../lancamentosManuais/lancamentosManuaisService.js";
import {
  classificarLancamento,
  type CentroParaClassificar,
  type ContaParaClassificar,
} from "./regrasClassificacao.js";
import { abasQueSomam } from "../dre/apuracaoUnidades.js";

/** Erro de regra — vira 404/409 no controller, não 500. */
export class RegraClassificacaoError extends Error {
  constructor(
    readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export const VALIDACOES_PENDENTES: ValidacaoLancamento[] = [
  "ERRO_PARAMETRIZACAO",
  "ERRO_DEPARTAMENTO",
  "ERRO_ATRIBUICAO",
  "SEM_DESTINO",
  "CENTRO_NAO_CADASTRADO",
  "SEM_ABA",
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
    throw new RegraClassificacaoError(404, `A competência ${rotulo(ano, mes)} não existe.`);
  }
  return competencia;
}

export type FiltroClassificacao = {
  ano: number;
  mes: number;
  /** PENDENCIAS, TODOS ou uma validação específica. */
  situacao: "PENDENCIAS" | "TODOS" | ValidacaoLancamento;
  busca?: string;
  pagina: number;
  porPagina: number;
};

export const classificacaoService = {
  /**
   * Recalcula os campos derivados de todos os lançamentos da competência, a
   * partir do cadastro vigente. É o que faz "corrigir o cadastro reclassifica
   * sem reimportar". Recusado em competência fechada: lá a classificação está
   * congelada.
   */
  async classificarCompetencia(competenciaId: string) {
    const prisma = getPrismaClient();
    const inicio = Date.now();

    const competencia = await prisma.competencia.findUniqueOrThrow({
      where: { id: competenciaId },
      select: { ano: true, mes: true, status: true },
    });
    if (competencia.status === "FECHADA") {
      throw new RegraClassificacaoError(
        409,
        `A competência ${rotulo(competencia.ano, competencia.mes)} está fechada; a classificação dela está congelada.`,
      );
    }

    const [lancamentos, centros, contas, reclassificacoes] = await Promise.all([
      prisma.lancamentoContabil.findMany({
        where: { competenciaId },
        select: { id: true, codigoCentroCusto: true, contaResultadoId: true, filial: true },
      }),
      prisma.centroCusto.findMany({
        where: { codigoRM: { not: null } },
        select: {
          id: true,
          codigoRM: true,
          departamento: true,
          atribuicao: true,
          balde: true,
        },
      }),
      prisma.contaResultado.findMany({
        select: {
          id: true,
          tipoConta: true,
          departamento: true,
          atribuicao: true,
          balde: true,
          linhaDREId: true,
          linhaDRE: { select: { descricao: true } },
        },
      }),
      prisma.reclassificacaoConta.findMany({
        where: { ativo: true },
        select: { codigoCentroCusto: true, contaOrigemId: true, contaDestinoId: true },
      }),
    ]);

    const centroPorCodigo = new Map<string, CentroParaClassificar>(
      centros.map((c) => [c.codigoRM!, c]),
    );
    const contaPorId = new Map<string, ContaParaClassificar>(
      contas.map(({ linhaDRE, ...c }) => [
        c.id,
        { ...c, linhaDREDescricao: linhaDRE?.descricao ?? null },
      ]),
    );
    // As linhas da DRE com as abas de cada uma (21/10/2026): a verificação "Sem Aba de Resultado".
    const linhasDRE = await prisma.linhaDRE.findMany({
      where: { ativo: true },
      select: { id: true, tipo: true, grupo: true, grupoSigla: true, atribuicao: true, descricao: true, unidades: { select: { unidadeNegocio: { select: { codigo: true } } } } },
    });
    const linhaPorId = new Map(linhasDRE.map((l) => [l.id, { ...l, unidades: l.unidades.map((u) => u.unidadeNegocio.codigo) }]));
    const tripla = (g: string, a: string | null, d: string) => `${g.trim().toUpperCase()}|${(a ?? "").trim().toUpperCase()}|${d.trim().toUpperCase()}`;
    const complementares = new Set(linhasDRE.filter((l) => l.tipo === "ITEM" && l.grupoSigla === "CSC").map((l) => tripla("", l.atribuicao, l.descricao)));

    const destinoDe = new Map(
      reclassificacoes.map((r) => [`${r.codigoCentroCusto}|${r.contaOrigemId}`, r.contaDestinoId]),
    );

    const agora = new Date();
    const contagem = new Map<ValidacaoLancamento, number>();
    let reclassificados = 0;

    const atualizacoes = lancamentos.map((l) => {
      const destino = l.codigoCentroCusto
        ? destinoDe.get(`${l.codigoCentroCusto}|${l.contaResultadoId}`)
        : undefined;
      if (destino) reclassificados++;
      const conta = contaPorId.get(destino ?? l.contaResultadoId)!;
      const centro = l.codigoCentroCusto
        ? (centroPorCodigo.get(l.codigoCentroCusto) ?? null)
        : null;
      const c = classificarLancamento(l.codigoCentroCusto, centro, conta);
      // Sem aba de resultado (21/10/2026): a combinação da linha e do balde que nenhuma aba soma.
      const linha = c.linhaDREId ? linhaPorId.get(c.linhaDREId) : undefined;
      if (c.validacao === "OK" && linha && linha.tipo === "ITEM") {
        const par = linha.grupoSigla === "CSM" && complementares.has(tripla("", linha.atribuicao, linha.descricao));
        if (!abasQueSomam(linha, { filial: l.filial, balde: c.balde, rateio: c.alocacao === "RATEIO", parNaComplementar: par }).length) c.validacao = "SEM_ABA";
      }
      contagem.set(c.validacao, (contagem.get(c.validacao) ?? 0) + 1);
      return { id: l.id, data: { ...c, classificadoEm: agora } };
    });

    await prisma.$transaction(
      async (tx) => {
        for (const u of atualizacoes) {
          await tx.lancamentoContabil.update({ where: { id: u.id }, data: u.data });
        }
      },
      { timeout: 120_000 },
    );

    // Os lançamentos manuais derivam rateio e destino da conta: correm junto.
    const manuais = await lancamentosManuaisService.rederivar(competenciaId);

    return {
      lancamentos: lancamentos.length,
      manuais,
      reclassificados,
      porValidacao: Object.fromEntries(contagem),
      duracaoMs: Date.now() - inicio,
    };
  },

  /**
   * Reclassificação avulsa, pela tela. Recusada em competência apurada: a
   * classificação dos lançamentos é parte do retrato congelado (Passo 21), e só
   * a reapuração da competência a refaz — junto com o resto do resultado.
   */
  async reclassificar(ano: number, mes: number) {
    const competencia = await competenciaPorAnoMes(ano, mes);
    const { apuradaEm } = await getPrismaClient().competencia.findUniqueOrThrow({ where: { id: competencia.id }, select: { apuradaEm: true } });
    if (apuradaEm) {
      throw new RegraClassificacaoError(
        409,
        `A competência ${rotulo(ano, mes)} está apurada; a classificação dela está congelada. Para recalcular, reapure a competência (tela da DRE).`,
      );
    }
    return this.classificarCompetencia(competencia.id);
  },

  async resumo(ano: number, mes: number) {
    const prisma = getPrismaClient();
    const competencia = await competenciaPorAnoMes(ano, mes);

    const [grupos, reclassificados, classificacao, naoClassificados] = await Promise.all([
      // A soma não vem do groupBy: com o adaptador do SQLite, o groupBy trunca
      // todas as somas para inteiro quando a primeira do resultado é inteira.
      // O aggregate, um por grupo, soma certo.
      prisma.lancamentoContabil
        .groupBy({ by: ["validacao"], where: { competenciaId: competencia.id }, _count: { _all: true } })
        .then((gs) =>
          Promise.all(
            gs.map(async (g) => ({
              ...g,
              _sum: (await prisma.lancamentoContabil.aggregate({ where: { competenciaId: competencia.id, validacao: g.validacao }, _sum: { valorMovimento: true } }))._sum,
            })),
          ),
        ),
      prisma.lancamentoContabil.count({
        where: {
          competenciaId: competencia.id,
          contaAdotadaId: { not: null },
          NOT: { contaAdotadaId: { equals: prisma.lancamentoContabil.fields.contaResultadoId } },
        },
      }),
      prisma.lancamentoContabil.aggregate({
        where: { competenciaId: competencia.id },
        _min: { classificadoEm: true },
      }),
      prisma.lancamentoContabil.count({
        where: { competenciaId: competencia.id, classificadoEm: null },
      }),
    ]);

    const porValidacao = grupos.map((g) => ({
      validacao: g.validacao,
      lancamentos: g._count._all,
      valor: (g._sum.valorMovimento ?? new Prisma.Decimal(0)).toFixed(2),
    }));

    return {
      competencia,
      total: porValidacao.reduce((n, g) => n + g.lancamentos, 0),
      pendentes: porValidacao
        .filter((g) => VALIDACOES_PENDENTES.includes(g.validacao))
        .reduce((n, g) => n + g.lancamentos, 0),
      reclassificados,
      naoClassificados,
      // A mais antiga: toda a competência foi classificada ao menos desde então.
      classificadoEm: classificacao._min.classificadoEm,
      porValidacao,
    };
  },

  async listar(filtro: FiltroClassificacao) {
    const prisma = getPrismaClient();
    const competencia = await competenciaPorAnoMes(filtro.ano, filtro.mes);
    const busca = filtro.busca?.trim();

    const where: Prisma.LancamentoContabilWhereInput = {
      competenciaId: competencia.id,
      ...(filtro.situacao === "PENDENCIAS"
        ? { validacao: { in: VALIDACOES_PENDENTES } }
        : filtro.situacao === "TODOS"
          ? {}
          : { validacao: filtro.situacao }),
      ...(busca
        ? {
            OR: [
              { codigoCentroCusto: { contains: busca } },
              { nomeCentroCusto: { contains: busca } },
              { contaResultado: { reduzido: { contains: busca } } },
              { contaResultado: { descricao: { contains: busca } } },
              { contaAdotada: { reduzido: { contains: busca } } },
            ],
          }
        : {}),
    };

    const contaCampos = {
      reduzido: true,
      descricao: true,
      departamento: true,
      atribuicao: true,
    } as const;

    const [itens, total] = await Promise.all([
      prisma.lancamentoContabil.findMany({
        where,
        orderBy: [{ filial: "asc" }, { codigoCentroCusto: "asc" }, { linhaArquivo: "asc" }],
        skip: (filtro.pagina - 1) * filtro.porPagina,
        take: filtro.porPagina,
        select: {
          id: true,
          filial: true,
          linhaArquivo: true,
          codigoCentroCusto: true,
          nomeCentroCusto: true,
          valorMovimento: true,
          validacao: true,
          balde: true,
          alocacao: true,
          etiqueta: true,
          contaResultadoId: true,
          contaAdotadaId: true,
          centroCusto: {
            select: { nomeRM: true, departamento: true, atribuicao: true },
          },
          contaResultado: { select: contaCampos },
          contaAdotada: { select: contaCampos },
          linhaDRE: { select: { codigo: true, descricao: true } },
        },
      }),
      prisma.lancamentoContabil.count({ where }),
    ]);

    return {
      competencia,
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      itens: itens.map(({ contaResultadoId, contaAdotadaId, valorMovimento, ...l }) => ({
        ...l,
        valorMovimento: valorMovimento.toFixed(2),
        reclassificado: contaAdotadaId !== null && contaAdotadaId !== contaResultadoId,
      })),
    };
  },
};
