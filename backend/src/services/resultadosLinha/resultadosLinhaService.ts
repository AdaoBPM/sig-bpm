import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ACESSO_TOTAL } from "../acesso/acesso.js";
import { ehCentroDeObra } from "../classificacao/centrosObra.js";
import { importacoesService } from "../importacoes/importacoesService.js";
import { manualNoSinalDoBalancete, VOLUMES_DA_DRE } from "../dre/apuracaoUnidades.js";
import { avaliarExpressao, codigosDaExpressao } from "../dre/expressao.js";
import { mesesDoExercicio, montar, type LinhaEstrutura } from "../relatorios/resultadosService.js";
import { valeNoMes } from "../volumes/vigenciasRateio.js";
import { alocar, fracoesDaTarefa, numeroDaObra, ROTULO_DO_NIVEL, semLinha, type Nivel, type Passo } from "./alocacaoNasLinhas.js";
import { linhasDoNegocio, pesosDaBase, receitaDoMes, volumeDaLinhaDRE, volumesDoMes, type Base, type ItemDaReceita, type LinhaDoNegocio, type Volume } from "./basesDasLinhas.js";

/**
 * Os Resultados por Linha (26/10/2026, pedido do Adão; Apuração dos Resultados): a DRE de cada linha de produto e de obra,
 * da receita à Margem de Contribuição, mês a mês. Parte da DRE apurada de cada unidade (Matriz, Filial e Serviços) e a
 * divide entre as linhas dela, sem refazer a apuração:
 *
 * - a receita (bruta e líquida, por natureza), pela Receita Prévia das linhas;
 * - os custos e as despesas variáveis de venda, lançamento a lançamento: a composição gravada de cada valor (os pares
 *   diretos de balde e filial e os rateios com o percentual da unidade) diz quais lançamentos o formaram, e cada parte vai
 *   às linhas pela ordem da Alocação nas Linhas — a tarefa das requisições e das notas fiscais, a regra do centro, a obra
 *   (os centros de obra), a regra do rateio e o volume da unidade; o que nenhum passo leva fica Sem Linha;
 * - os volumes (as linhas P e S), pelas listas, na regra da aba Totais.
 *
 * A soma das linhas de cada unidade é a DRE da unidade (a Conferência). A parte de cada custo que veio dos centros de obra
 * é direta nas obras; o resto é o que a aba Rateios para Obras leva às obras (os Resultados por Obra).
 */

const Decimal = Prisma.Decimal;
const n = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();
const prefixo = (codigo: string) => codigo.split(".")[0];
const NOME_DA_UNIDADE: Record<number, string> = { 1: "Matriz", 2: "Filial", 3: "Serviços" };
/** As chaves de rateio (os lançamentos manuais delas entram como rateio, como na apuração). */
const CHAVES_DE_RATEIO = new Set(["PROJETO", "PRODUCAO", "METALURGIA", "ARMADURA", "ACOMPANHAMENTO"]);
/** Os itens da DRE dos Resultados por Linha: os volumes, as receitas, os custos e as despesas variáveis de venda. */
const ITENS = new Set(["P", "S", "ROB", "ROL", "CPP", "CSM", "CSC", "DVV"]);
const SECOES = new Set(["PS", "P", "S"]);
const CUSTOS = new Set(["CPP", "CSM", "CSC", "DVV"]);
/** A aba Rateios para Obras: só os custos (e os volumes, a base). */
const DOS_RATEIOS = new Set(["PS", "P", "S", "CPP", "CSM", "CSC", "CPV", "DVV"]);
const NATUREZA_DA_RECEITA: Record<string, string> = {
  RBPF: "PRE_FABRICADO", RLPF: "PRE_FABRICADO", RBF: "FRETE", RLF: "FRETE", RBM: "MONTAGEM", RLM: "MONTAGEM",
  RBC: "COMPLEMENTAR", RLC: "COMPLEMENTAR", RBDI: "DEVOLUCOES_INVENTARIOS", RLDI: "DEVOLUCOES_INVENTARIOS",
};
const MC = "MC.MARGEM_DE_CONTRIBUICAO_MC";

type LinhaDRE = LinhaEstrutura & { expressao: string | null; unidades: number[] };
type Par = { balde: string; filial?: number };
type OrigemContabil = { linhaId: string; pares?: Par[]; baldes?: string[]; fator?: string };
type Composicao = { origem?: { contabil?: OrigemContabil; contabilPar?: OrigemContabil }; rateios?: Array<{ chave: string; percentual: string; linhaId?: string }> };
/** Um grupo de lançamentos (os contábeis e os manuais) com o mesmo contexto: a linha da DRE, o balde, a filial, o centro e a conta. */
type Fonte = { linhaDREId: string; balde: string; filial: number; rateio: boolean; centroCustoId: string | null; codigoCentro: string | null; reduzido: string | null; valor: number };
type Regra = { origem: string; centroCustoId: string | null; balde: string | null; destino: string; linhaId: string | null; base: string | null };
type DadosDoMes = { volumes: Volume[]; receita: ItemDaReceita[] };

async function estruturaDaDRE(): Promise<LinhaDRE[]> {
  const ls = await getPrismaClient().linhaDRE.findMany({
    where: { ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, codigo: true, tipo: true, grupo: true, grupoSigla: true, descricao: true, expressao: true, unidades: { select: { unidadeNegocio: { select: { codigo: true } } } } },
  });
  return ls.map(({ unidades, ...l }) => ({ ...l, unidades: unidades.map((u) => u.unidadeNegocio.codigo) }));
}

/** As linhas da DRE da tabela: os itens do escopo, as seções dos volumes e os totais feitos só deles (até a MC). */
function escopo(est: LinhaDRE[], prefixos: Set<string>) {
  const s = new Set(est.filter((l) => (l.tipo === "ITEM" && prefixos.has(prefixo(l.codigo)) && ITENS.has(prefixo(l.codigo))) || (l.tipo === "SECAO" && SECOES.has(prefixo(l.codigo)) && prefixos.has(prefixo(l.codigo)))).map((l) => l.codigo));
  for (let mudou = true; mudou; ) {
    mudou = false;
    for (const l of est) {
      if (s.has(l.codigo) || l.tipo === "ITEM" || l.tipo === "SECAO" || !l.expressao || !prefixos.has(prefixo(l.codigo))) continue;
      if (codigosDaExpressao(l.expressao).every((c) => s.has(c))) {
        s.add(l.codigo);
        mudou = true;
      }
    }
  }
  return s;
}

/** Os lançamentos do mês, contábeis e manuais (fora do balde RN), agrupados pelo contexto, no sinal do balancete. */
async function fontesDoMes(competenciaId: string): Promise<Fonte[]> {
  const prisma = getPrismaClient();
  const [contabeis, manuais] = await Promise.all([
    prisma.lancamentoContabil.findMany({
      where: { competenciaId, linhaDREId: { not: null } },
      select: { linhaDREId: true, balde: true, filial: true, alocacao: true, valorMovimento: true, centroCustoId: true, codigoCentroCusto: true, contaResultado: { select: { reduzido: true } } },
    }),
    prisma.lancamentoManual.findMany({
      where: { competenciaId, linhaDREId: { not: null } },
      select: { linhaDREId: true, balde: true, filial: true, valor: true, centroCustoId: true, centroCusto: { select: { codigoRM: true } }, contaResultado: { select: { reduzido: true } }, linhaDRE: { select: { grupoSigla: true } } },
    }),
  ]);
  const grupos = new Map<string, Fonte>();
  const somar = (f: Omit<Fonte, "valor">, v: number) => {
    const k = [f.linhaDREId, f.balde, f.filial, f.rateio ? 1 : 0, f.centroCustoId ?? "", f.codigoCentro ?? "", f.reduzido ?? ""].join("|");
    const g = grupos.get(k);
    if (g) g.valor += v;
    else grupos.set(k, { ...f, valor: v });
  };
  for (const l of contabeis) {
    somar(
      { linhaDREId: l.linhaDREId!, balde: l.balde ?? "", filial: l.filial, rateio: l.alocacao === "RATEIO", centroCustoId: l.centroCustoId, codigoCentro: l.codigoCentroCusto, reduzido: l.contaResultado.reduzido },
      Number(l.valorMovimento),
    );
  }
  for (const m of manuais) {
    if (n(m.balde) === "RN") continue;
    somar(
      { linhaDREId: m.linhaDREId!, balde: m.balde ?? "", filial: m.filial, rateio: CHAVES_DE_RATEIO.has(m.balde ?? ""), centroCustoId: m.centroCustoId, codigoCentro: m.centroCusto?.codigoRM ?? null, reduzido: m.contaResultado?.reduzido ?? null },
      Number(manualNoSinalDoBalancete(m.linhaDRE!.grupoSigla, m.valor)),
    );
  }
  return [...grupos.values()];
}

const tarefaNormalizada = (t: string | null | undefined) => (t ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const chaveDoDocumento = (reduzido: string | null, centro: string | null, filial: number | null) => `${reduzido ?? ""}|${centro ?? ""}|${filial ?? ""}`;

/** As requisições e as notas fiscais do mês, por conta, centro e filial: o valor de cada linha (pela tarefa) e o sem tarefa. */
async function documentosDoMes(competenciaId: string) {
  const prisma = getPrismaClient();
  const sel = { filial: true, codigoCentroCusto: true, contaContabil: true, nomeTarefa: true, valorTotal: true } as const;
  const [requisicoes, notas, correspondencias] = await Promise.all([
    prisma.requisicaoItem.findMany({ where: { competenciaId }, select: sel }),
    prisma.notaFiscalItem.findMany({ where: { competenciaId }, select: sel }),
    prisma.correspondenciaTarefa.findMany({ select: { filial: true, tarefa: true, linhaId: true } }),
  ]);
  const linhaDaTarefa = (filial: number | null, tarefa: string | null) => {
    const t = tarefaNormalizada(tarefa);
    if (!t) return null;
    return (
      correspondencias.find((c) => c.filial !== null && c.filial === filial && tarefaNormalizada(c.tarefa) === t) ?? correspondencias.find((c) => c.filial === null && tarefaNormalizada(c.tarefa) === t)
    )?.linhaId ?? null;
  };
  const porChave = new Map<string, { porLinha: Map<string, number>; sem: number }>();
  for (const d of [...requisicoes, ...notas]) {
    const k = chaveDoDocumento(d.contaContabil, d.codigoCentroCusto, d.filial);
    const g = porChave.get(k) ?? { porLinha: new Map<string, number>(), sem: 0 };
    const linhaId = linhaDaTarefa(d.filial, d.nomeTarefa);
    if (linhaId) g.porLinha.set(linhaId, (g.porLinha.get(linhaId) ?? 0) + Number(d.valorTotal));
    else g.sem += Number(d.valorTotal);
    porChave.set(k, g);
  }
  return { porChave, requisicoes: requisicoes.length, notas: notas.length };
}

/** O resultado de um mês: o valor de cada linha (e da Sem Linha de cada unidade) em cada item, e a parte direta nas obras. */
type ResultadoDoMes = {
  valores: Map<string, Map<string, number>>;
  naObra: Map<string, Map<string, number>>;
  niveis: Map<number, Map<Nivel, number>>;
  mcDaDRE: Map<number, number>;
  avisos: string[];
  documentos: { requisicoes: number; notas: number };
};

async function calcularMes(
  competencia: { id: string; ano: number; mes: number },
  linhas: LinhaDoNegocio[],
  est: LinhaDRE[],
  dadosDoMes: DadosDoMes,
  dadosDoAno: DadosDoMes,
): Promise<ResultadoDoMes> {
  const prisma = getPrismaClient();
  const [fontes, documentos, unidades, regras, obras] = await Promise.all([
    fontesDoMes(competencia.id),
    documentosDoMes(competencia.id),
    prisma.resultadoApurado.findMany({
      where: { competenciaId: competencia.id, centroCustoId: null, unidadeNegocio: { codigo: { in: [1, 2, 3] } } },
      select: { valor: true, composicao: true, linhaDRE: { select: { codigo: true, tipo: true } }, unidadeNegocio: { select: { codigo: true } } },
    }),
    prisma.alocacaoLinha.findMany({ select: { origem: true, centroCustoId: true, balde: true, destino: true, linhaId: true, base: true, vigenciaInicio: true, vigenciaFim: true } }),
    prisma.obra.findMany({ select: { id: true, codigo: true } }),
  ]);
  const vigentes = regras.filter((r) => valeNoMes({ inicio: r.vigenciaInicio, fim: r.vigenciaFim }, competencia.ano, competencia.mes));
  const regraDoCentro = new Map<string, Regra>(vigentes.filter((r) => r.origem === "CENTRO" && r.centroCustoId).map((r) => [r.centroCustoId!, r]));
  const regraDoBalde = new Map<string, Regra>(vigentes.filter((r) => r.origem === "RATEIO" && r.balde).map((r) => [r.balde!, r]));
  const obraDoNumero = new Map<string, { id: string; codigo: string }>();
  for (const o of obras) if (!obraDoNumero.has(numeroDaObra(o.codigo))) obraDoNumero.set(numeroDaObra(o.codigo), o);

  const fontesDaLinha = new Map<string, Fonte[]>();
  const doBalancete = new Map<string, number>();
  for (const f of fontes) {
    fontesDaLinha.set(f.linhaDREId, [...(fontesDaLinha.get(f.linhaDREId) ?? []), f]);
    const k = chaveDoDocumento(f.reduzido, f.codigoCentro, f.filial);
    doBalancete.set(k, (doBalancete.get(k) ?? 0) + f.valor);
  }
  const fracoes = new Map<string, Map<string, number>>();
  for (const [k, g] of documentos.porChave) fracoes.set(k, fracoesDaTarefa(doBalancete.get(k) ?? 0, g.porLinha, g.sem));

  const linhasDa = (u: number) => new Set(linhas.filter((l) => l.unidade === u).map((l) => l.id));
  const porUnidade = new Map([1, 2, 3].map((u) => [u, linhasDa(u)]));
  const r: ResultadoDoMes = { valores: new Map(), naObra: new Map(), niveis: new Map(), mcDaDRE: new Map(), avisos: [], documentos: { requisicoes: documentos.requisicoes, notas: documentos.notas } };
  const somar = (alvo: Map<string, Map<string, number>>, linha: string, codigo: string, v: number) => {
    const m = alvo.get(linha) ?? new Map<string, number>();
    m.set(codigo, (m.get(codigo) ?? 0) + v);
    alvo.set(linha, m);
  };
  const registrar = (u: number, codigo: string, partes: Array<{ linhaId: string; nivel: Nivel; valor: number }>, naObra: boolean) => {
    for (const p of partes) {
      somar(r.valores, p.linhaId, codigo, p.valor);
      if (naObra) somar(r.naObra, p.linhaId, codigo, p.valor);
      const niv = r.niveis.get(u) ?? new Map<Nivel, number>();
      niv.set(p.nivel, (niv.get(p.nivel) ?? 0) + p.valor);
      r.niveis.set(u, niv);
    }
  };

  const umaLinha = (u: number, linhaId: string | null) => (linhaId && porUnidade.get(u)!.has(linhaId) ? new Map([[linhaId, 1]]) : null);
  const pelaRegra = (u: number, regra: Regra | undefined) =>
    !regra ? null : regra.destino === "LINHA" ? umaLinha(u, regra.linhaId) : pesosDaBase(regra.base as Base, u, dadosDoMes);
  const baseDaUnidade = (u: number): Base => (u === 3 ? "DIAS_ACOMPANHAMENTO" : "M3_PRODUZIDO");
  /** A obra do centro de obra: a produção (ou os acompanhamentos, ou a receita nas despesas variáveis de venda) da obra no mês; sem ela, no ano. */
  const pelaObra = (u: number, f: Fonte | null, grupo: string) => {
    if (!f?.codigoCentro || !ehCentroDeObra(f.codigoCentro)) return null;
    const obra = obraDoNumero.get(numeroDaObra(f.codigoCentro));
    if (!obra) return null;
    const base: Base = grupo === "DVV" ? "RECEITA" : baseDaUnidade(u);
    const montagem = (dados: DadosDoMes) => {
      const m = new Map<string, number>();
      for (const v of dados.volumes) if (v.total === "MONTAGEM" && v.obraId === obra.id) m.set(v.linhaId, (m.get(v.linhaId) ?? 0) + v.quantidade);
      return m;
    };
    for (const dados of [dadosDoMes, dadosDoAno]) {
      const p = pesosDaBase(base, u, dados, obra);
      if (p.size) return p;
      if (u === 3 && base === "DIAS_ACOMPANHAMENTO") {
        const m = montagem(dados);
        if (m.size) return m;
      }
    }
    return null;
  };

  const linhaDRE = new Map(est.map((l) => [l.codigo, l]));
  for (const row of unidades) {
    const u = row.unidadeNegocio!.codigo;
    const codigo = row.linhaDRE.codigo;
    const V = Number(row.valor);
    if (codigo === MC) r.mcDaDRE.set(u, V);
    if (row.linhaDRE.tipo !== "ITEM") continue;
    const grupo = prefixo(codigo);

    if (grupo === "ROB" || grupo === "ROL") {
      // A receita: pela Receita Prévia das linhas, na natureza da conta (bruta ou líquida).
      const natureza = NATUREZA_DA_RECEITA[codigo.split(".")[1]];
      const pesos = new Map<string, number>();
      for (const i of dadosDoMes.receita) {
        if (i.unidade !== u || i.natureza !== natureza) continue;
        const k = i.linhaId ?? semLinha(u);
        pesos.set(k, (pesos.get(k) ?? 0) + (grupo === "ROL" ? i.liquida : i.bruta));
      }
      // A receita sem linha na Receita Prévia (ou a conta sem itens no mês, como as devoluções contábeis) segue a receita
      // bruta das linhas da unidade; sem nenhuma, fica Sem Linha.
      const pelaReceita = (valor: number) => alocar(valor, new Map(), [{ nivel: "UNIDADE", pesos: () => pesosDaBase("RECEITA", u, dadosDoMes) }], semLinha(u));
      const soma = [...pesos.values()].reduce((s, v) => s + v, 0);
      const partes =
        Math.abs(soma) < 0.005
          ? Math.abs(V) >= 0.005
            ? pelaReceita(V)
            : []
          : [...pesos].flatMap(([linhaId, p]) => (linhaId === semLinha(u) ? pelaReceita((V * p) / soma) : [{ linhaId, nivel: "RECEITA" as Nivel, valor: (V * p) / soma }]));
      registrar(u, codigo, partes, false);
      const sem = partes.filter((p) => p.nivel === "SEM_LINHA").reduce((s, p) => s + p.valor, 0);
      if (Math.abs(sem) >= 1) r.avisos.push(`${NOME_DA_UNIDADE[u]}: ${linhaDRE.get(codigo)?.descricao ?? codigo} de ${sem.toFixed(2)} sem linha na Receita Prévia e sem receita na unidade: ficou Sem Linha.`);
      continue;
    }
    if (!CUSTOS.has(grupo)) continue;

    // Os custos: os lançamentos que formaram o valor da unidade (os diretos e os rateios, pela composição gravada).
    const comp = row.composicao as Composicao | null;
    const partes: Array<{ f: Fonte | null; a: number }> = [];
    const casa = (o: OrigemContabil, f: Fonte) => (o.pares ? o.pares.some((p) => p.balde === f.balde && (p.filial === undefined || p.filial === f.filial)) : o.baldes ? o.baldes.includes(f.balde) : true);
    for (const o of [comp?.origem?.contabil, comp?.origem?.contabilPar]) {
      if (!o) continue;
      const fator = o.fator ? Number(o.fator) : 1;
      for (const f of fontesDaLinha.get(o.linhaId) ?? []) if (!f.rateio && casa(o, f)) partes.push({ f, a: fator * f.valor });
    }
    for (const x of comp?.rateios ?? []) {
      const linhaId = x.linhaId ?? comp?.origem?.contabil?.linhaId;
      const p = Number(x.percentual);
      for (const f of linhaId ? (fontesDaLinha.get(linhaId) ?? []) : []) if (f.rateio && f.balde === x.chave) partes.push({ f, a: p * f.valor });
    }
    const refeito = partes.reduce((s, p) => s + p.a, 0);
    if (Math.abs(V - refeito) >= 0.01) {
      partes.push({ f: null, a: V - refeito });
      if (Math.abs(V - refeito) >= 1)
        r.avisos.push(`${NOME_DA_UNIDADE[u]}: ${linhaDRE.get(codigo)?.descricao ?? codigo} — a DRE (${V.toFixed(2)}) difere dos lançamentos (${refeito.toFixed(2)}); a diferença foi pelo volume da unidade.`);
    }
    for (const { f, a } of partes) {
      if (Math.abs(a) < 1e-9) continue;
      const tarefa = new Map([...(f ? (fracoes.get(chaveDoDocumento(f.reduzido, f.codigoCentro, f.filial)) ?? new Map<string, number>()) : new Map<string, number>())].filter(([l]) => porUnidade.get(u)!.has(l)));
      const passos: Passo[] = [
        { nivel: "CENTRO", pesos: () => (f?.centroCustoId ? pelaRegra(u, regraDoCentro.get(f.centroCustoId)) : null) },
        { nivel: "OBRA", pesos: () => pelaObra(u, f, grupo) },
        { nivel: "RATEIO", pesos: () => (f ? pelaRegra(u, regraDoBalde.get(f.balde)) : null) },
        { nivel: "UNIDADE", pesos: () => pesosDaBase(baseDaUnidade(u), u, dadosDoMes) },
      ];
      registrar(u, codigo, alocar(a, tarefa, passos, semLinha(u)), !!f?.codigoCentro && ehCentroDeObra(f.codigoCentro));
    }
  }

  // Os volumes de cada linha (as linhas P e S da DRE), pelas listas.
  for (const u of [1, 2, 3]) {
    for (const l of est) {
      if (l.tipo !== "ITEM" || !l.unidades.includes(u) || (prefixo(l.codigo) !== "P" && prefixo(l.codigo) !== "S")) continue;
      const totais = VOLUMES_DA_DRE[u]?.[n(l.descricao)] ?? [];
      for (const [linhaId, v] of volumeDaLinhaDRE(totais, dadosDoMes.volumes)) if (porUnidade.get(u)!.has(linhaId)) somar(r.valores, linhaId, l.codigo, v);
    }
  }
  return r;
}

/** Os totais da linha (as subtotais e os totais do escopo), pelas expressões da DRE; só os que têm algum item com valor. */
function comTotais(itens: Map<string, number>, est: LinhaDRE[], noEscopo: Set<string>) {
  const valores = new Map(itens);
  const porCodigo = new Map(est.map((l) => [l.codigo, l]));
  const avaliar = (codigo: string, pilha = new Set<string>()): number | undefined => {
    if (valores.has(codigo)) return valores.get(codigo);
    const l = porCodigo.get(codigo);
    if (!l || l.tipo === "ITEM" || l.tipo === "SECAO" || !l.expressao || !noEscopo.has(codigo) || pilha.has(codigo)) return undefined;
    pilha.add(codigo);
    let algum = false;
    const v = Number(
      avaliarExpressao(l.expressao, (c) => {
        const x = avaliar(c, pilha);
        if (x !== undefined) algum = true;
        return new Decimal(x ?? 0);
      }),
    );
    if (!algum) return undefined;
    valores.set(codigo, v);
    return v;
  };
  for (const l of est) if (noEscopo.has(l.codigo)) avaliar(l.codigo);
  return valores;
}

const arredonda = (x: number) => Math.round(x * 100) / 100;

export const resultadosLinhaService = {
  /** `somenteFechadas` (o padrão da tela): só as competências fechadas, como em Resultados Empresariais. */
  async calcular(ano: number, ate?: number, somenteFechadas = true) {
    const { ultimo, meses } = await mesesDoExercicio(ano, ate, somenteFechadas);
    const [linhas, est] = await Promise.all([linhasDoNegocio(), estruturaDaDRE()]);
    const comps = await getPrismaClient().competencia.findMany({ where: { ano }, select: { id: true, mes: true, status: true } });
    const statusDoMes = new Map(comps.map((c) => [c.mes, c.status]));
    const dados: Array<DadosDoMes | null> = [];
    for (const m of meses) dados.push(m.competenciaId ? { volumes: await volumesDoMes(m.competenciaId, linhas), receita: await receitaDoMes(m.competenciaId, linhas) } : null);
    const doAno: DadosDoMes = { volumes: dados.flatMap((d) => d?.volumes ?? []), receita: dados.flatMap((d) => d?.receita ?? []) };
    const porMes: Array<ResultadoDoMes | null> = [];
    for (const [i, m] of meses.entries()) porMes.push(m.competenciaId ? await calcularMes({ id: m.competenciaId, ano, mes: m.mes }, linhas, est, dados[i]!, doAno) : null);

    const apurado = meses.map((m) => m.competenciaId !== null);
    const noResultado = escopo(est, new Set([...ITENS, ...SECOES, "RO", "IRB", "CPV", "MB", "MC"]));
    const nosRateios = escopo(est, DOS_RATEIOS);
    const estDo = (s: Set<string>) => est.filter((l) => s.has(l.codigo));
    const tabela = (linhaId: string, unidade: number, s: Set<string>, rateado: boolean) => {
      const valores = porMes.map((r) => {
        const todos = r?.valores.get(linhaId) ?? new Map<string, number>();
        const obra = r?.naObra.get(linhaId) ?? new Map<string, number>();
        const itens = new Map<string, number>();
        for (const [codigo, v] of todos) {
          if (!s.has(codigo)) continue;
          const parte = rateado && CUSTOS.has(prefixo(codigo)) ? v - (obra.get(codigo) ?? 0) : v;
          itens.set(codigo, arredonda(parte));
        }
        return comTotais(itens, est, s);
      });
      return montar(estDo(s), unidade as 1 | 2 | 3, apurado, valores, valores, ACESSO_TOTAL).map((l) => ({ ...l, podeDetalhar: false }));
    };
    const temValor = (linhaId: string) => porMes.some((r) => [...(r?.valores.get(linhaId)?.values() ?? [])].some((v) => Math.abs(v) >= 0.005));
    const comValor = linhas.filter((l) => l.ativo || temValor(l.id));

    const niveis = (Object.keys(ROTULO_DO_NIVEL) as Nivel[]).map((nivel) => ({
      nivel,
      rotulo: ROTULO_DO_NIVEL[nivel],
      porUnidade: [1, 2, 3].map((u) => ({ unidade: u, meses: porMes.map((r) => (r ? arredonda(r.niveis.get(u)?.get(nivel) ?? 0) : null)) })),
    }));
    const mcDasLinhas = (u: number, r: ResultadoDoMes) =>
      [...linhas.filter((l) => l.unidade === u).map((l) => l.id), semLinha(u)].reduce((s, id) => {
        const v = comTotais(new Map([...(r.valores.get(id) ?? [])].filter(([c]) => noResultado.has(c))), est, noResultado).get(MC);
        return s + (v ?? 0);
      }, 0);

    return {
      ano,
      ate: ultimo,
      meses: meses.map(({ mes, rotulo, competenciaId }) => ({ mes, rotulo, apurado: competenciaId !== null, fechada: statusDoMes.get(mes) === "FECHADA" })),
      linhas: comValor.map((l) => ({
        id: l.id,
        codigo: l.codigo,
        nome: l.nome,
        unidade: l.unidade,
        nomeUnidade: NOME_DA_UNIDADE[l.unidade],
        ativo: l.ativo,
        resultado: tabela(l.id, l.unidade, noResultado, false),
        rateios: tabela(l.id, l.unidade, nosRateios, true),
      })),
      conferencia: {
        unidades: [1, 2, 3].map((u) => ({
          unidade: u,
          nome: NOME_DA_UNIDADE[u],
          meses: porMes.map((r) => (r ? { mcDaDRE: arredonda(r.mcDaDRE.get(u) ?? 0), mcDasLinhas: arredonda(mcDasLinhas(u, r)), semLinha: arredonda([...(r.valores.get(semLinha(u))?.entries() ?? [])].filter(([c]) => CUSTOS.has(prefixo(c)) || prefixo(c) === "ROB").reduce((s, [, v]) => s + v, 0)) } : null)),
          semLinha: tabela(semLinha(u), u, noResultado, false),
        })),
        niveis,
        documentos: meses.map((m, i) => ({ mes: m.mes, rotulo: m.rotulo, requisicoes: porMes[i]?.documentos.requisicoes ?? 0, notas: porMes[i]?.documentos.notas ?? 0 })),
        avisos: porMes.flatMap((r, i) => (r ? r.avisos.map((a) => `${meses[i].rotulo}: ${a}`) : [])),
      },
    };
  },

  /**
   * As requisições e as notas fiscais de cada competência do exercício: a importação em vigor (a última concluída) e a
   * última tentativa, de cada tipo.
   */
  async documentos(ano: number) {
    const prisma = getPrismaClient();
    const comps = await prisma.competencia.findMany({ where: { ano }, orderBy: { mes: "asc" }, select: { id: true, mes: true, status: true } });
    const importacoes = await prisma.importacao.findMany({
      where: { competenciaId: { in: comps.map((c) => c.id) }, tipo: { in: [...TIPOS_DE_DOCUMENTOS] } },
      orderBy: { importadoEm: "desc" },
      select: { competenciaId: true, tipo: true, status: true, progresso: true, importadoEm: true, nomeArquivo: true, linhasAceitas: true, motivoRejeicao: true, substituidaEm: true, resumo: true, usuario: { select: { nome: true } } },
    });
    type Imp = (typeof importacoes)[number];
    const resumir = (i: Imp | undefined) =>
      i
        ? {
            status: i.status,
            progresso: i.progresso,
            importadoEm: i.importadoEm,
            nomeArquivo: i.nomeArquivo,
            itens: i.linhasAceitas,
            total: typeof (i.resumo as { total?: unknown } | null)?.total === "string" ? Number((i.resumo as { total: string }).total) : null,
            motivo: i.motivoRejeicao,
            usuario: i.usuario?.nome ?? null,
          }
        : null;
    const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    return comps.map((c) => {
      const doTipo = (tipo: string) => importacoes.filter((i) => i.competenciaId === c.id && i.tipo === tipo);
      const tipo = (t: string) => ({ vigente: resumir(doTipo(t).find((i) => i.status === "CONCLUIDA" && !i.substituidaEm)), ultima: resumir(doTipo(t)[0]) });
      return { mes: c.mes, rotulo: `${MESES[c.mes - 1]}/${String(ano).slice(2)}`, fechada: c.status === "FECHADA", requisicoes: tipo("REQUISICOES"), notas: tipo("NOTAS_FISCAIS") };
    });
  },

  /** Importa as abas Requisições (Lista) e Notas Fiscais (Lista) de um arquivo, numa competência (também fechada). */
  async importarDocumentos(ano: number, mes: number, nomeArquivo: string, conteudo: Buffer, usuarioId: string) {
    const recebidas = [];
    for (const tipo of TIPOS_DE_DOCUMENTOS) recebidas.push(await importacoesService.receber({ ano, mes, tipo, nomeArquivo, conteudo, usuarioId, forcar: true }));
    return recebidas;
  },
};

const TIPOS_DE_DOCUMENTOS = ["REQUISICOES", "NOTAS_FISCAIS"] as const;
