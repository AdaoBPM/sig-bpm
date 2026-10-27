import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { ACESSO_TOTAL } from "../acesso/acesso.js";
import { auditar } from "../auditoriaService.js";
import { ehCentroDeObra } from "../classificacao/centrosObra.js";
import { manualNoSinalDoBalancete, VOLUMES_DA_DRE } from "../dre/apuracaoUnidades.js";
import { avaliarExpressao, codigosDaExpressao } from "../dre/expressao.js";
import { mesesDoExercicio, montar, type LinhaEstrutura } from "../relatorios/resultadosService.js";
import { valeNoMes } from "../volumes/vigenciasRateio.js";
import { alocar, fracoesDaTarefa, numeroDaObra, ROTULO_DO_NIVEL, semLinha, type Nivel, type Passo } from "./alocacaoNasLinhas.js";
import { linhasDoNegocio, pesosDaBase, receitaDoMes, volumeDaLinhaDRE, volumesDoMes, type Base, type ItemDaReceita, type LinhaDoNegocio, type Volume } from "./basesDasLinhas.js";

/**
 * Os Resultados por Linha (26/10/2026, pedido do Adão): a DRE de cada linha de produto e de obra, da receita à Margem de
 * Contribuição. A etapa Linhas da apuração da competência, depois da DRE, parte da DRE apurada de cada unidade (Matriz,
 * Filial e Serviços), a divide entre as linhas dela e grava o resultado (ResultadoLinha), que fica congelado com o
 * fechamento. Resultados Empresariais (as abas Linhas e Rateios por Obras) e a etapa Linhas do mês leem o gravado. A
 * divisão:
 *
 * - a receita (bruta e líquida, por natureza), pela Receita Prévia das linhas;
 * - os custos e as despesas variáveis de venda, lançamento a lançamento: a composição gravada de cada valor (os pares
 *   diretos de balde e filial e os rateios com o percentual da unidade) diz quais lançamentos o formaram, e cada parte vai
 *   às linhas pela ordem da Alocação nas Linhas — a tarefa das requisições e das notas fiscais, a regra do centro, a obra
 *   (os centros de obra), os percentuais por linha do rateio fixo (26/10/2026: a parte de rateio de uma chave com
 *   percentual fixo, pelo destino dela), a regra do rateio e o volume da unidade; o que nenhum passo leva fica Sem Linha;
 * - os volumes (as linhas P e S), pelas listas, na regra da aba Totais.
 *
 * A soma das linhas de cada unidade é a DRE da unidade (a Conferência). A parte de cada custo que veio dos centros de obra
 * é direta nas obras; o resto é o que a aba Rateios por Obras leva às obras (os Resultados por Obra).
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
/** A aba Rateios por Obras: só os custos (e os volumes, a base). */
const DOS_RATEIOS = new Set(["PS", "P", "S", "CPP", "CSM", "CSC", "CPV", "DVV"]);
const NATUREZA_DA_RECEITA: Record<string, string> = {
  RBPF: "PRE_FABRICADO", RLPF: "PRE_FABRICADO", RBF: "FRETE", RLF: "FRETE", RBM: "MONTAGEM", RLM: "MONTAGEM",
  RBC: "COMPLEMENTAR", RLC: "COMPLEMENTAR", RBDI: "DEVOLUCOES_INVENTARIOS", RLDI: "DEVOLUCOES_INVENTARIOS",
};
const MC = "MC.MARGEM_DE_CONTRIBUICAO_MC";

type LinhaDRE = LinhaEstrutura & { expressao: string | null; unidades: number[] };
type Par = { balde: string; filial?: number };
type OrigemContabil = { linhaId: string; pares?: Par[]; baldes?: string[]; fator?: string };
type Composicao = { origem?: { contabil?: OrigemContabil; contabilPar?: OrigemContabil }; rateios?: Array<{ chave: string; destino?: string; percentual: string; linhaId?: string }> };
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
  const [fontes, documentos, unidades, regras, obras, fixas] = await Promise.all([
    fontesDoMes(competencia.id),
    documentosDoMes(competencia.id),
    prisma.resultadoApurado.findMany({
      where: { competenciaId: competencia.id, centroCustoId: null, unidadeNegocio: { codigo: { in: [1, 2, 3] } } },
      select: { valor: true, composicao: true, linhaDRE: { select: { codigo: true, tipo: true } }, unidadeNegocio: { select: { codigo: true } } },
    }),
    prisma.alocacaoLinha.findMany({ select: { origem: true, centroCustoId: true, balde: true, destino: true, linhaId: true, base: true, vigenciaInicio: true, vigenciaFim: true } }),
    prisma.obra.findMany({ select: { id: true, codigo: true } }),
    // Os percentuais por linha dos rateios fixos (26/10/2026).
    prisma.regraRateio.findMany({
      where: { percentualFixo: { not: null }, linhas: { some: {} } },
      select: { chave: true, destino: true, vigenciaInicio: true, vigenciaFim: true, linhas: { select: { linhaId: true, percentual: true } } },
    }),
  ]);
  const vigentes = regras.filter((r) => valeNoMes({ inicio: r.vigenciaInicio, fim: r.vigenciaFim }, competencia.ano, competencia.mes));
  const regraDoCentro = new Map<string, Regra>(vigentes.filter((r) => r.origem === "CENTRO" && r.centroCustoId).map((r) => [r.centroCustoId!, r]));
  const regraDoBalde = new Map<string, Regra>(vigentes.filter((r) => r.origem === "RATEIO" && r.balde).map((r) => [r.balde!, r]));
  // A parte de rateio de uma chave com percentual fixo no mês vai às linhas pelos percentuais por linha do destino dela
  // (chave|destino → linha → fração), no lugar da regra do rateio.
  const fixoDoDestino = new Map(
    fixas
      .filter((r) => valeNoMes({ inicio: r.vigenciaInicio, fim: r.vigenciaFim }, competencia.ano, competencia.mes))
      .map((r) => [`${r.chave}|${r.destino}`, new Map(r.linhas.map((l) => [l.linhaId, Number(l.percentual)]))]),
  );
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
    const partes: Array<{ f: Fonte | null; a: number; destino?: string }> = [];
    const casa = (o: OrigemContabil, f: Fonte) => (o.pares ? o.pares.some((p) => p.balde === f.balde && (p.filial === undefined || p.filial === f.filial)) : o.baldes ? o.baldes.includes(f.balde) : true);
    for (const o of [comp?.origem?.contabil, comp?.origem?.contabilPar]) {
      if (!o) continue;
      const fator = o.fator ? Number(o.fator) : 1;
      for (const f of fontesDaLinha.get(o.linhaId) ?? []) if (!f.rateio && casa(o, f)) partes.push({ f, a: fator * f.valor });
    }
    for (const x of comp?.rateios ?? []) {
      const linhaId = x.linhaId ?? comp?.origem?.contabil?.linhaId;
      const p = Number(x.percentual);
      for (const f of linhaId ? (fontesDaLinha.get(linhaId) ?? []) : []) if (f.rateio && f.balde === x.chave) partes.push({ f, a: p * f.valor, destino: x.destino });
    }
    const refeito = partes.reduce((s, p) => s + p.a, 0);
    if (Math.abs(V - refeito) >= 0.01) {
      partes.push({ f: null, a: V - refeito });
      if (Math.abs(V - refeito) >= 1)
        r.avisos.push(`${NOME_DA_UNIDADE[u]}: ${linhaDRE.get(codigo)?.descricao ?? codigo} — a DRE (${V.toFixed(2)}) difere dos lançamentos (${refeito.toFixed(2)}); a diferença foi pelo volume da unidade.`);
    }
    for (const { f, a, destino } of partes) {
      if (Math.abs(a) < 1e-9) continue;
      const tarefa = new Map([...(f ? (fracoes.get(chaveDoDocumento(f.reduzido, f.codigoCentro, f.filial)) ?? new Map<string, number>()) : new Map<string, number>())].filter(([l]) => porUnidade.get(u)!.has(l)));
      // O rateio fixo com os percentuais por linha (26/10/2026): só as linhas da unidade.
      const fixo = f?.rateio && destino ? fixoDoDestino.get(`${f.balde}|${destino}`) : undefined;
      const passos: Passo[] = [
        { nivel: "CENTRO", pesos: () => (f?.centroCustoId ? pelaRegra(u, regraDoCentro.get(f.centroCustoId)) : null) },
        { nivel: "OBRA", pesos: () => pelaObra(u, f, grupo) },
        { nivel: "FIXO", pesos: () => (fixo ? new Map([...fixo].filter(([l, p]) => p > 0 && porUnidade.get(u)!.has(l))) : null) },
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
const rotulo = (ano: number, mes: number) => `${String(mes).padStart(2, "0")}/${ano}`;
/** O mês no rótulo das colunas, como nos Resultados Empresariais ("SET/26"). */
const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const ROL = "RO.RECEITA_OPERACIONAL_LIQUIDA_ROL";
/** As linhas da DRE das abas Linhas (da receita à Margem de Contribuição) e Rateios por Obras (os custos, sobre os volumes). */
const DO_RESULTADO = new Set([...ITENS, ...SECOES, "RO", "IRB", "CPV", "MB", "MC"]);

export class RegraLinhasError extends Error {
  constructor(
    readonly status: 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** O resumo da etapa Linhas gravado na competência (Competencia.apuracaoLinhas), com as unidades pelo código. */
export type ApuracaoLinhas = {
  gravadaEm: string;
  /** De que passo da Alocação nas Linhas veio cada valor, por unidade. */
  niveis: Record<string, Partial<Record<Nivel, number>>>;
  /** A Margem de Contribuição da DRE apurada de cada unidade (a Conferência). */
  mcDaDRE: Record<string, number>;
  documentos: { requisicoes: number; notas: number };
  avisos: string[];
};

/** Os valores gravados de uma competência: por chave da linha (o id, ou a Sem Linha da unidade) e por código da DRE. */
type Gravado = { valores: Map<string, Map<string, number>>; naObra: Map<string, Map<string, number>> };

async function gravados(competenciaIds: string[], linhaId?: string): Promise<Map<string, Gravado>> {
  const rows = await getPrismaClient().resultadoLinha.findMany({
    where: { competenciaId: { in: competenciaIds }, ...(linhaId ? { linhaId } : {}) },
    select: { competenciaId: true, unidade: true, linhaId: true, valor: true, naObra: true, linhaDRE: { select: { codigo: true } } },
  });
  const r = new Map<string, Gravado>(competenciaIds.map((id) => [id, { valores: new Map(), naObra: new Map() }]));
  for (const x of rows) {
    const g = r.get(x.competenciaId)!;
    const chave = x.linhaId ?? semLinha(x.unidade);
    for (const [alvo, v] of [
      [g.valores, Number(x.valor)],
      [g.naObra, Number(x.naObra)],
    ] as const) {
      const m = alvo.get(chave) ?? new Map<string, number>();
      m.set(x.linhaDRE.codigo, (m.get(x.linhaDRE.codigo) ?? 0) + v);
      alvo.set(chave, m);
    }
  }
  return r;
}

/** Os itens de uma linha num mês, no escopo e com os totais; `rateado`: nos custos, só a parte que não veio dos centros de obra. */
function itensDaLinha(g: Gravado, chave: string, est: LinhaDRE[], s: Set<string>, rateado = false) {
  const obra = g.naObra.get(chave) ?? new Map<string, number>();
  const itens = new Map<string, number>();
  for (const [codigo, v] of g.valores.get(chave) ?? []) {
    if (!s.has(codigo)) continue;
    itens.set(codigo, arredonda(rateado && CUSTOS.has(prefixo(codigo)) ? v - (obra.get(codigo) ?? 0) : v));
  }
  return comTotais(itens, est, s);
}

/**
 * As competências fechadas do exercício até o mês. Só as que têm as linhas gravadas contam como apuradas; as fechadas
 * antes da etapa Linhas (26/10/2026) e ainda sem a gravação vão em `semLinhas`.
 */
/**
 * Os meses das abas: as competências fechadas do exercício até `ate` (Resultados Empresariais) ou, com `soOMes`
 * (27/10/2026: a etapa Linhas do Fechamento Mensal), só a competência `ate`, em qualquer situação, com as linhas da
 * última apuração.
 */
async function periodo(ano: number, ate?: number, soOMes = false) {
  if (soOMes && ate) {
    const c = await getPrismaClient().competencia.findUnique({ where: { ano_mes: { ano, mes: ate } }, select: { id: true, apuracaoLinhas: true } });
    if (!c) throw new RegraLinhasError(404, `A competência ${rotulo(ano, ate)} não existe.`);
    const gravada = c.apuracaoLinhas !== null;
    const rotuloDoMes = `${MESES_CURTOS[ate - 1]}/${String(ano).slice(2)}`;
    return { ultimo: ate, meses: [{ mes: ate, rotulo: rotuloDoMes, apurado: gravada, competenciaId: gravada ? c.id : null }], semLinhas: gravada ? [] : [rotuloDoMes] };
  }
  const { ultimo, meses } = await mesesDoExercicio(ano, ate, true);
  const ids = meses.flatMap((m) => (m.competenciaId ? [m.competenciaId] : []));
  const comps = await getPrismaClient().competencia.findMany({ where: { id: { in: ids } }, select: { id: true, apuracaoLinhas: true } });
  const comLinhas = new Set(comps.filter((c) => c.apuracaoLinhas !== null).map((c) => c.id));
  const gravada = (id: string | null) => id !== null && comLinhas.has(id);
  return {
    ultimo,
    meses: meses.map((m) => ({ mes: m.mes, rotulo: m.rotulo, apurado: gravada(m.competenciaId), competenciaId: gravada(m.competenciaId) ? m.competenciaId : null })),
    semLinhas: meses.filter((m) => m.competenciaId !== null && !gravada(m.competenciaId)).map((m) => m.rotulo),
  };
}

const descricaoDaLinha = (l: LinhaDoNegocio) => ({ id: l.id, codigo: l.codigo, nome: l.nome, unidade: l.unidade, nomeUnidade: NOME_DA_UNIDADE[l.unidade], ativo: l.ativo });

export const resultadosLinhaService = {
  /**
   * A etapa Linhas da apuração (26/10/2026): divide a DRE apurada de cada unidade entre as linhas dela e grava o valor de
   * cada linha em cada item (ResultadoLinha), com o resumo na competência (os passos, os documentos e os avisos). A obra
   * sem produção no mês usa a do exercício até ele.
   */
  async apurar(competenciaId: string) {
    const prisma = getPrismaClient();
    const c = await prisma.competencia.findUniqueOrThrow({ where: { id: competenciaId }, select: { id: true, ano: true, mes: true } });
    const [linhas, est, codigos, doAno] = await Promise.all([
      linhasDoNegocio(),
      estruturaDaDRE(),
      prisma.linhaDRE.findMany({ select: { id: true, codigo: true } }),
      prisma.competencia.findMany({ where: { ano: c.ano, mes: { lte: c.mes } }, select: { id: true }, orderBy: { mes: "asc" } }),
    ]);
    const dadosDoAno: DadosDoMes = { volumes: [], receita: [] };
    let dadosDoMes: DadosDoMes = { volumes: [], receita: [] };
    for (const x of doAno) {
      const d = { volumes: await volumesDoMes(x.id, linhas), receita: await receitaDoMes(x.id, linhas) };
      dadosDoAno.volumes.push(...d.volumes);
      dadosDoAno.receita.push(...d.receita);
      if (x.id === c.id) dadosDoMes = d;
    }
    const r = await calcularMes(c, linhas, est, dadosDoMes, dadosDoAno);

    const idDoCodigo = new Map(codigos.map((l) => [l.codigo, l.id]));
    const unidadeDa = new Map(linhas.map((l) => [l.id, l.unidade]));
    const rows: Prisma.ResultadoLinhaCreateManyInput[] = [];
    for (const [chave, itens] of r.valores) {
      const sem = chave.startsWith("SEM_LINHA|");
      const unidade = sem ? Number(chave.split("|")[1]) : unidadeDa.get(chave);
      if (!unidade) continue;
      for (const [codigo, valor] of itens) {
        const naObra = r.naObra.get(chave)?.get(codigo) ?? 0;
        const linhaDREId = idDoCodigo.get(codigo);
        if (!linhaDREId || (Math.abs(valor) < 1e-9 && Math.abs(naObra) < 1e-9)) continue;
        rows.push({ competenciaId: c.id, unidade, linhaId: sem ? null : chave, linhaDREId, valor: new Decimal(valor), naObra: new Decimal(naObra) });
      }
    }
    const resumo: ApuracaoLinhas = {
      gravadaEm: new Date().toISOString(),
      niveis: Object.fromEntries([...r.niveis].map(([u, m]) => [String(u), Object.fromEntries(m)])),
      mcDaDRE: Object.fromEntries([...r.mcDaDRE].map(([u, v]) => [String(u), v])),
      documentos: r.documentos,
      avisos: r.avisos,
    };
    await prisma.$transaction([
      prisma.resultadoLinha.deleteMany({ where: { competenciaId: c.id } }),
      // Em lotes: cada registro leva sete parâmetros, e o PostgreSQL aceita até 65 535 por comando.
      ...Array.from({ length: Math.ceil(rows.length / 5000) }, (_, i) => prisma.resultadoLinha.createMany({ data: rows.slice(i * 5000, (i + 1) * 5000) })),
      prisma.competencia.update({ where: { id: c.id }, data: { apuracaoLinhas: resumo as unknown as Prisma.InputJsonValue } }),
    ]);
    const semLinha = [...r.valores].filter(([k]) => k.startsWith("SEM_LINHA|")).reduce((s, [, m]) => s + [...m].filter(([cod]) => CUSTOS.has(prefixo(cod)) || prefixo(cod) === "ROB").reduce((t, [, v]) => t + v, 0), 0);
    return { registros: rows.length, linhas: new Set(rows.map((x) => x.linhaId).filter(Boolean)).size, semLinha: arredonda(semLinha), avisos: r.avisos };
  },

  /**
   * As linhas das unidades pedidas, para a lista das abas Linhas e Rateios por Obras dos Resultados Empresariais: as ativas
   * e as inativas com valor nas competências fechadas do exercício até o mês.
   */
  async listar(ano: number, ate: number | undefined, unidades: number[], soOMes = false) {
    const p = await periodo(ano, ate, soOMes);
    const ids = p.meses.flatMap((m) => (m.competenciaId ? [m.competenciaId] : []));
    const comValor = new Set(
      (await getPrismaClient().resultadoLinha.groupBy({ by: ["linhaId"], where: { competenciaId: { in: ids }, linhaId: { not: null }, valor: { not: 0 } } })).map((x) => x.linhaId),
    );
    const linhas = (await linhasDoNegocio()).filter((l) => unidades.includes(l.unidade) && (l.ativo || comValor.has(l.id)));
    return { ano, ate: p.ultimo, linhas: linhas.map(descricaoDaLinha), semLinhas: p.semLinhas };
  },

  /**
   * A DRE de uma linha mês a mês, da receita à Margem de Contribuição (a aba Linhas), ou só os custos dela que não vieram
   * dos centros de obra, sobre os volumes (`rateios`: a aba Rateios por Obras, o que os Resultados por Obra levam às obras).
   */
  async linha(ano: number, ate: number | undefined, linhaId: string, rateios: boolean, unidades: number[], soOMes = false) {
    const l = (await linhasDoNegocio()).find((x) => x.id === linhaId && unidades.includes(x.unidade));
    if (!l) throw new RegraLinhasError(404, "A linha não existe ou não é de uma unidade que o seu perfil lê.");
    const [p, est] = await Promise.all([periodo(ano, ate, soOMes), estruturaDaDRE()]);
    const g = await gravados(p.meses.flatMap((m) => (m.competenciaId ? [m.competenciaId] : [])), l.id);
    const s = escopo(est, rateios ? DOS_RATEIOS : DO_RESULTADO);
    const valores = p.meses.map((m) => (m.competenciaId ? itensDaLinha(g.get(m.competenciaId)!, l.id, est, s, rateios) : new Map<string, number>()));
    return {
      ano,
      ate: p.ultimo,
      meses: p.meses.map(({ mes, rotulo, apurado }) => ({ mes, rotulo, apurado })),
      linhas: montar(est.filter((x) => s.has(x.codigo)), l.unidade as 1 | 2 | 3, p.meses.map((m) => m.apurado), valores, valores, ACESSO_TOTAL).map((x) => ({ ...x, podeDetalhar: false })),
      linha: descricaoDaLinha(l),
      semLinhas: p.semLinhas,
    };
  },

  /**
   * A etapa Linhas do Fechamento Mensal: a conferência do mês gravado — a Margem de Contribuição da DRE de cada unidade
   * contra a soma das linhas, a Sem Linha, de que passo veio cada valor, os documentos e os avisos — e a receita líquida e
   * a margem de cada linha.
   */
  async doMes(ano: number, mes: number) {
    const prisma = getPrismaClient();
    const c = await prisma.competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true, status: true, apuradaEm: true, apuracaoLinhas: true } });
    if (!c) throw new RegraLinhasError(404, `A competência ${rotulo(ano, mes)} não existe.`);
    const resumo = c.apuracaoLinhas as ApuracaoLinhas | null;
    const situacao = { status: c.status, apurada: c.apuradaEm !== null, gravadaEm: resumo?.gravadaEm ?? null, podeGravar: c.status === "FECHADA" && !resumo };
    if (!resumo) return { situacao, unidades: [], niveis: [], documentos: null, avisos: [], linhas: [] };
    const [linhas, est, g] = await Promise.all([linhasDoNegocio(), estruturaDaDRE(), gravados([c.id])]);
    const gravado = g.get(c.id)!;
    const s = escopo(est, DO_RESULTADO);
    const totais = new Map([...gravado.valores.keys()].map((k) => [k, itensDaLinha(gravado, k, est, s)]));
    const soma = (xs: number[]) => arredonda(xs.reduce((a, b) => a + b, 0));
    return {
      situacao,
      unidades: [1, 2, 3].map((u) => ({
        unidade: u,
        nome: NOME_DA_UNIDADE[u],
        mcDaDRE: arredonda(resumo.mcDaDRE[u] ?? 0),
        mcDasLinhas: soma([...linhas.filter((l) => l.unidade === u).map((l) => l.id), semLinha(u)].map((k) => totais.get(k)?.get(MC) ?? 0)),
        semLinha: soma([...(gravado.valores.get(semLinha(u)) ?? [])].filter(([cod]) => CUSTOS.has(prefixo(cod)) || prefixo(cod) === "ROB").map(([, v]) => v)),
      })),
      niveis: (Object.keys(ROTULO_DO_NIVEL) as Nivel[])
        .map((nivel) => ({ nivel, rotulo: ROTULO_DO_NIVEL[nivel], porUnidade: [1, 2, 3].map((u) => arredonda(resumo.niveis[u]?.[nivel] ?? 0)) }))
        .filter((x) => x.porUnidade.some((v) => Math.abs(v) >= 0.005)),
      documentos: resumo.documentos,
      avisos: resumo.avisos,
      linhas: linhas
        .filter((l) => l.ativo || totais.has(l.id))
        .map((l) => ({ ...descricaoDaLinha(l), receitaLiquida: totais.get(l.id)?.get(ROL) ?? null, mc: totais.get(l.id)?.get(MC) ?? null })),
    };
  },

  /**
   * Grava as linhas de uma competência fechada antes da etapa Linhas (26/10/2026), com a Alocação nas Linhas e as tarefas
   * de hoje. Uma vez só: depois, as linhas mudam como o resto do mês, reabrindo e reapurando.
   */
  async gravarFechada(ano: number, mes: number, usuarioId: string) {
    const c = await getPrismaClient().competencia.findUnique({ where: { ano_mes: { ano, mes } }, select: { id: true, status: true, apuracaoLinhas: true } });
    if (!c) throw new RegraLinhasError(404, `A competência ${rotulo(ano, mes)} não existe.`);
    if (c.status !== "FECHADA") throw new RegraLinhasError(409, `A competência ${rotulo(ano, mes)} está aberta: as linhas dela são gravadas na apuração.`);
    if (c.apuracaoLinhas !== null) throw new RegraLinhasError(409, `As linhas de ${rotulo(ano, mes)} já estão gravadas: para refazê-las, reabra a competência e apure de novo.`);
    const r = await this.apurar(c.id);
    await auditar({
      usuarioId,
      acao: "APURACAO",
      entidade: "competencia",
      entidadeId: c.id,
      metadados: { competencia: rotulo(ano, mes), resultado: "linhas gravadas na competência fechada", etapas: ["linhas"], registros: r.registros, semLinha: r.semLinha },
    });
    return this.doMes(ano, mes);
  },
};
