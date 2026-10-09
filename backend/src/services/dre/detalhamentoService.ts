import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { NaturezaReceita } from "../../generated/prisma/enums.js";
import type { Composicao, OrigemValor, ParcelaRateio } from "./apuracaoUnidades.js";
import { ACESSO_TOTAL, type Acesso } from "../acesso/acesso.js";
import { podeVerCentro, podeVerMovimentos } from "../acesso/recorteDepartamento.js";
import { grupoDoCentro, RegraDREError } from "./dreService.js";
import { CENTRO_DE_OBRA, sinalDaLinha } from "./obrasService.js";

/**
 * Detalhamento de um valor da DRE até os lançamentos de origem (Passo 20).
 *
 * Parte da composição gravada na apuração: a origem de cada valor é um filtro
 * sobre os dados da competência (os lançamentos contábeis, os de rateio, os
 * manuais e a receita prévia), com o fator ou o percentual que a regra
 * aplicou. A soma das parcelas é o valor da linha; quando a linha é derivada
 * (uma receita líquida, uma guarda que zerou o valor), o detalhamento diz isso.
 */

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;
const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
const NOME_UNIDADE: Record<number, string> = { 1: "Matriz", 2: "Filial", 3: "Serviços", 4: "Despesas e Extra", 5: "RN" };
const ROTULO_NATUREZA: Record<string, string> = {
  PRE_FABRICADO: "pré-fabricado",
  FRETE: "frete",
  DEVOLUCOES_INVENTARIOS: "devoluções e inventários",
  MONTAGEM: "montagem",
  COMPLEMENTAR: "complementar",
};

export type Visao = { unidade: number } | { consolidado: true } | { grupo: string } | { obra: string };

type LancamentoDetalhe = {
  id: string;
  filial: number;
  centro: { codigoRM: string | null; nome: string | null } | null;
  conta: { reduzido: string; descricao: string };
  contaAdotada: { reduzido: string; descricao: string } | null;
  balde: string | null;
  alocacao: string | null;
  descricao?: string;
  valor: string;
  parcela: string;
};

type Bloco =
  | {
      tipo: "CONTABIL" | "RATEIO" | "MANUAL";
      titulo: string;
      unidade?: number;
      filtro: string;
      fator?: string;
      percentual?: string;
      total: string;
      lancamentos: LancamentoDetalhe[];
    }
  | { tipo: "PREVIA"; titulo: string; unidade: number; natureza: string; componente: string; sinal: number; total: string };

const selecaoContabil = {
  id: true,
  filial: true,
  balde: true,
  alocacao: true,
  valorMovimento: true,
  codigoCentroCusto: true,
  nomeCentroCusto: true,
  centroCusto: { select: { codigoRM: true, nomeRM: true } },
  contaResultado: { select: { reduzido: true, descricao: true } },
  contaAdotada: { select: { reduzido: true, descricao: true } },
} satisfies Prisma.LancamentoContabilSelect;
type Contabil = Prisma.LancamentoContabilGetPayload<{ select: typeof selecaoContabil }>;

function paraDetalhe(l: Contabil, multiplicador: Decimal): LancamentoDetalhe {
  const adotada = l.contaAdotada && l.contaAdotada.reduzido !== l.contaResultado.reduzido ? l.contaAdotada : null;
  return {
    id: l.id,
    filial: l.filial,
    centro:
      l.centroCusto || l.codigoCentroCusto
        ? { codigoRM: l.centroCusto?.codigoRM ?? l.codigoCentroCusto, nome: l.centroCusto?.nomeRM ?? l.nomeCentroCusto }
        : null,
    conta: l.contaResultado,
    contaAdotada: adotada,
    balde: l.balde,
    alocacao: l.alocacao,
    valor: l.valorMovimento.toFixed(2),
    parcela: l.valorMovimento.times(multiplicador).toFixed(2),
  };
}

const somar = (xs: Decimal[]) => xs.reduce((a, x) => a.plus(x), new Decimal(0));
const porValor = (a: { valor: string }, b: { valor: string }) => Math.abs(Number(b.valor)) - Math.abs(Number(a.valor));

/** Os blocos de origem de um valor apurado de unidade. */
async function blocosDaUnidade(competenciaId: string, unidade: number, c: Composicao): Promise<Bloco[]> {
  const prisma = getPrismaClient();
  const o: OrigemValor = c.origem ?? {};
  const blocos: Bloco[] = [];
  const naoRateio: Prisma.LancamentoContabilWhereInput = { OR: [{ alocacao: null }, { alocacao: { not: "RATEIO" } }] };

  if (o.contabil) {
    const f = o.contabil;
    const filtros: Prisma.LancamentoContabilWhereInput[] = [naoRateio];
    if (f.baldes) filtros.push({ balde: { in: f.baldes as never } });
    if (f.excetoBaldes) filtros.push({ OR: [{ balde: null }, { balde: { notIn: f.excetoBaldes as never } }] });
    if (f.pares) filtros.push({ OR: f.pares.map((p) => ({ balde: p.balde as never, ...(p.filial !== undefined ? { filial: p.filial } : {}) })) });
    const ls = await prisma.lancamentoContabil.findMany({
      where: { competenciaId, linhaDREId: f.linhaId, ...(f.filial !== undefined ? { filial: f.filial } : {}), AND: filtros },
      select: selecaoContabil,
    });
    const fator = new Decimal(f.fator ?? 1);
    const partes = [
      f.pares ? null : f.filial !== undefined ? `filial ${f.filial}` : "todas as filiais",
      f.baldes ? `balde ${f.baldes.join(", ")}` : null,
      f.excetoBaldes ? `fora do balde ${f.excetoBaldes.join(", ")}` : null,
      f.pares ? f.pares.map((p) => (p.filial === undefined ? `balde ${p.balde}` : `balde ${p.balde} da filial ${p.filial}`)).join(" + ") : null,
    ].filter(Boolean);
    blocos.push({
      tipo: "CONTABIL",
      titulo: "Lançamentos contábeis diretos",
      unidade,
      filtro: partes.join(" · "),
      fator: f.fator,
      total: somar(ls.map((l) => l.valorMovimento)).times(fator).toFixed(2),
      lancamentos: ls.map((l) => paraDetalhe(l, fator)).sort(porValor),
    });
  }

  for (const r of (c.rateios ?? []) as ParcelaRateio[]) {
    if (!r.linhaId) continue;
    const ls = await prisma.lancamentoContabil.findMany({
      where: { competenciaId, linhaDREId: r.linhaId, alocacao: "RATEIO", balde: r.chave as never },
      select: selecaoContabil,
    });
    const p = new Decimal(r.percentual);
    blocos.push({
      tipo: "RATEIO",
      titulo: `Rateio ${r.chave.toLowerCase()} → ${r.destino.toLowerCase()}`,
      unidade,
      filtro: `lançamentos de rateio do balde ${r.chave}, linha ${r.base.split(": ")[0]}`,
      percentual: r.percentual,
      total: somar(ls.map((l) => l.valorMovimento)).times(p).toFixed(2),
      lancamentos: ls.map((l) => paraDetalhe(l, p)).sort(porValor),
    });
  }

  if (o.manual) {
    const ms = await prisma.lancamentoManual.findMany({
      where: { competenciaId, linhaDREId: o.manual.linhaId, balde: o.manual.balde as never },
      select: {
        id: true,
        filial: true,
        balde: true,
        descricao: true,
        motivo: true,
        valor: true,
        centroCusto: { select: { codigoRM: true, nomeRM: true } },
        contaResultado: { select: { reduzido: true, descricao: true } },
      },
    });
    blocos.push({
      tipo: "MANUAL",
      titulo: "Lançamentos manuais",
      unidade,
      filtro: `balde ${o.manual.balde}`,
      total: somar(ms.map((m) => m.valor)).toFixed(2),
      lancamentos: ms
        .map((m) => ({
          id: m.id,
          filial: m.filial,
          centro: m.centroCusto ? { codigoRM: m.centroCusto.codigoRM, nome: m.centroCusto.nomeRM } : null,
          conta: m.contaResultado ?? { reduzido: "—", descricao: m.descricao },
          contaAdotada: null,
          balde: m.balde,
          alocacao: "MANUAL",
          descricao: `${m.motivo} · ${m.descricao}`,
          valor: m.valor.toFixed(2),
          parcela: m.valor.toFixed(2),
        }))
        .sort(porValor),
    });
  }

  for (const pv of o.previa ?? []) {
    const r = await prisma.receitaPrevia.findFirst({
      where: { competenciaId, natureza: pv.natureza as NaturezaReceita, unidadeNegocio: { codigo: pv.unidade } },
      select: { receitaBruta: true, receitaLiquida: true },
    });
    const v = r ? (pv.componente === "BRUTA" ? r.receitaBruta : r.receitaLiquida) : new Decimal(0);
    blocos.push({
      tipo: "PREVIA",
      titulo: `Receita prévia · ${ROTULO_NATUREZA[pv.natureza] ?? pv.natureza} (${pv.componente === "BRUTA" ? "bruta" : "líquida"})${pv.sinal < 0 ? ", com sinal trocado" : ""}`,
      unidade: pv.unidade,
      natureza: pv.natureza,
      componente: pv.componente,
      sinal: pv.sinal,
      total: v.times(pv.sinal).toFixed(2),
    });
  }
  return blocos;
}

export const detalhamentoService = {
  /** O detalhamento de uma linha da DRE numa visão (unidade, consolidado ou agrupamento de centros). */
  async detalhar(ano: number, mes: number, codigo: string, visao: Visao, acesso: Acesso = ACESSO_TOTAL) {
    const prisma = getPrismaClient();
    const c = await prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true } });
    if (!c) throw new RegraDREError(404, `A competência ${rotulo(ano, mes)} não existe.`);
    const linha = await prisma.linhaDRE.findUnique({ where: { codigo }, select: { id: true, codigo: true, descricao: true, tipo: true, grupoSigla: true } });
    if (!linha) throw new RegraDREError(404, `A linha ${codigo} não está na estrutura da DRE.`);
    // Recorte do Gestor (Passo 22): só as movimentações das linhas dos seus departamentos.
    if (!podeVerMovimentos(acesso, linha)) {
      throw new RegraDREError(403, `As movimentações de "${linha.descricao}" não são de um departamento seu.`);
    }

    let valor: Decimal | null = null;
    let regra: string | null = null;
    let observacao: string | null = null;
    const blocos: Bloco[] = [];
    let titulo: string;

    if ("obra" in visao) {
      // A obra (aba Obras): os lançamentos do centro de obra na linha, com o sinal da DRE (receitas trocadas).
      if (!CENTRO_DE_OBRA.test(visao.obra)) throw new RegraDREError(400, `${visao.obra} não é um centro de custo de obra (1.98 ou 1.99).`);
      const ls = await prisma.lancamentoContabil.findMany({ where: { competenciaId: c.id, linhaDREId: linha.id, codigoCentroCusto: visao.obra }, select: selecaoContabil });
      titulo = `Obra ${ls[0]?.nomeCentroCusto ?? visao.obra} (${visao.obra})`;
      regra = "Lançamentos contábeis do centro de obra, diretos e de rateio, antes do rateio";
      if (ls.length > 0) {
        const fator = new Decimal(sinalDaLinha(linha.codigo));
        valor = somar(ls.map((l) => l.valorMovimento)).times(fator);
        blocos.push({
          tipo: "CONTABIL",
          titulo: "Lançamentos contábeis",
          filtro: "todas as filiais, diretos e de rateio",
          ...(fator.isNegative() ? { fator: "-1" } : {}),
          total: valor.toFixed(2),
          lancamentos: ls.map((l) => paraDetalhe(l, fator)).sort(porValor),
        });
      } else {
        observacao = "Linha que soma outras linhas da obra: veja o detalhamento de cada uma.";
      }
    } else if ("grupo" in visao) {
      titulo = `Centro de custo ${visao.grupo}`;
      const centros = await prisma.centroCusto.findMany({ select: { id: true, nomeControladoria: true, departamento: true } });
      const ids = centros.filter((x) => grupoDoCentro(x) === visao.grupo && podeVerCentro(acesso, x.departamento)).map((x) => x.id);
      if (ids.length === 0) throw new RegraDREError(403, `O centro de custo ${visao.grupo} não é de um departamento seu.`);
      const [gravados, ls] = await Promise.all([
        prisma.resultadoApurado.findMany({ where: { competenciaId: c.id, linhaDREId: linha.id, centroCustoId: { in: ids } }, select: { valor: true, composicao: true } }),
        prisma.lancamentoContabil.findMany({ where: { competenciaId: c.id, linhaDREId: linha.id, centroCustoId: { in: ids } }, select: selecaoContabil }),
      ]);
      valor = gravados.length ? somar(gravados.map((g) => g.valor)) : null;
      regra = "Lançamentos contábeis dos centros do agrupamento, diretos e de rateio, antes do rateio";
      if (ls.length > 0) {
        blocos.push({
          tipo: "CONTABIL",
          titulo: "Lançamentos contábeis",
          filtro: "todas as filiais, diretos e de rateio",
          total: somar(ls.map((l) => l.valorMovimento)).toFixed(2),
          lancamentos: ls.map((l) => paraDetalhe(l, new Decimal(1))).sort(porValor),
        });
      } else if (valor) {
        observacao = "Linha que soma outras linhas do agrupamento: veja o detalhamento de cada uma.";
      }
    } else {
      const unidadeFiltro = "unidade" in visao ? { unidadeNegocio: { codigo: visao.unidade } } : { unidadeNegocioId: null };
      titulo = "unidade" in visao ? NOME_UNIDADE[visao.unidade] : "Consolidado";
      const gravado = await prisma.resultadoApurado.findFirst({
        where: { competenciaId: c.id, linhaDREId: linha.id, centroCustoId: null, ...unidadeFiltro },
        select: { valor: true, composicao: true },
      });
      if (!gravado) throw new RegraDREError(404, `A linha ${linha.descricao} não tem valor apurado em ${titulo} (${rotulo(ano, mes)}).`);
      valor = gravado.valor;
      const comp = gravado.composicao as Composicao | null;
      regra = comp?.regra ?? null;

      if ("unidade" in visao) {
        if (comp?.origem || comp?.rateios?.length) blocos.push(...(await blocosDaUnidade(c.id, visao.unidade, comp)));
      } else if (comp?.unidades?.length || linha.tipo !== "ITEM") {
        // Consolidado: a origem de cada unidade que compôs o item. Também num
        // total cuja origem está nas unidades: os Impostos Operacionais são, no
        // Consolidado, ROB − ROL, que é a soma dos lançamentos da linha em cada
        // unidade. Os demais totais não têm origem nas unidades (são somas de
        // linhas) e continuam com a observação de subtotal.
        const porUnidade = await prisma.resultadoApurado.findMany({
          where: { competenciaId: c.id, linhaDREId: linha.id, centroCustoId: null, unidadeNegocioId: { not: null } },
          select: { composicao: true, unidadeNegocio: { select: { codigo: true } } },
        });
        for (const r of porUnidade.sort((a, b) => a.unidadeNegocio!.codigo - b.unidadeNegocio!.codigo)) {
          const cu = r.composicao as Composicao | null;
          if (cu?.origem || cu?.rateios?.length) blocos.push(...(await blocosDaUnidade(c.id, r.unidadeNegocio!.codigo, cu)));
        }
      }
      if (blocos.length === 0) {
        observacao =
          linha.tipo === "ITEM" && !valor.isZero()
            ? "Valor derivado de outras linhas (a regra acima), sem lançamento de origem próprio."
            : linha.tipo === "ITEM"
              ? "Valor zero pela regra da unidade (a regra acima)."
              : "Subtotal ou total: soma das linhas que o compõem, pela estrutura da DRE.";
      }
    }

    const somaOrigens = blocos.length ? somar(blocos.map((b) => new Decimal(b.total))) : null;
    return {
      competencia: { ano, mes },
      visao: titulo,
      linha: { codigo: linha.codigo, descricao: linha.descricao, tipo: linha.tipo },
      valor: valor?.toFixed(2) ?? null,
      regra,
      observacao,
      somaOrigens: somaOrigens?.toFixed(2) ?? null,
      blocos,
    };
  },
};
