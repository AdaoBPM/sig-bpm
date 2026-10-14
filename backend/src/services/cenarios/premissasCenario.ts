import { getPrismaClient } from "../../config/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { LinhaEstrutura } from "../dre/apuracaoUnidades.js";
import { estrutura } from "../dre/dreService.js";
import { diasUteis } from "./calendario.js";
import { alocarCentros, centrosDoCadastro, percentuaisDoCenario, percentuaisDoRealizado } from "./centrosCenario.js";
import { recalcular, UNIDADES } from "./edicaoCenario.js";

type Tx = Prisma.TransactionClient;

/**
 * As premissas dos cenários analíticos (13/10/2026, etapa 2): as tabelas Matriz, Filial e Serviços da tela Premissas e
 * o cálculo da DRE a partir delas. Em Matriz e Filial, uma tabela para a venda Global e outra para a Mercantil; em
 * Serviços, só a Global. Cada tabela tem, mês a mês:
 *
 * - Jornada: os dias úteis (o calendário — segunda a sexta menos os feriados nacionais —, editável);
 * - Ajustes: o percentual sobre a receita (bruta e líquida) e o percentual sobre os custos e despesas;
 * - Produção e Serviços: a demanda diária de cada linha do cadastro Linhas da unidade, na Und. de Medida dela (nas
 *   linhas de "m³ e pistas", as pistas por dia e os m³ por pista: o m³ é o m³/pista × as pistas); o volume do mês é a
 *   demanda × os dias úteis;
 * - Receita Operacional: por linha, a receita bruta média de cada conta da ROB (R$ por unidade da linha — o m³, nas
 *   de pistas), os impostos operacionais (%/ROB) e a receita líquida média (calculada);
 * - Custos de Produção / Serviços: por linha, as Matérias Primas e os Gastos Gerais Variáveis (por conta) e o Estoque,
 *   em R$ por unidade da linha;
 * - Despesas Variáveis de Venda: por linha, os Gastos Gerais Variáveis da DVV (por conta), em R$ por unidade.
 *
 * O valor de cada conta no mês é o volume × o valor unitário × (1 + o ajuste); a receita líquida, a bruta × (1 − os
 * impostos). As contas das tabelas somam-se na DRE da unidade (as de Global e Mercantil juntas), com os volumes
 * (produção, pistas, metalurgia, expedição e montagem), e os totais e o Consolidado se calculam pela Estrutura da DRE.
 * As demais contas (mão de obra, gastos gerais diretos e indiretos, depreciação, despesas e o extra-operacional) virão
 * dos centros de custo, dos investimentos e do extra-operacional (as próximas etapas).
 */

export type Venda = "GLOBAL" | "MERCANTIL";
export type UnidadePremissa = 1 | 2 | 3;
export const UNIDADES_PREMISSAS: readonly UnidadePremissa[] = [1, 2, 3];
export const VENDAS_DA_UNIDADE: Record<UnidadePremissa, Venda[]> = { 1: ["GLOBAL", "MERCANTIL"], 2: ["GLOBAL", "MERCANTIL"], 3: ["GLOBAL"] };
export const NOME_DA_UNIDADE: Record<UnidadePremissa, string> = { 1: "Matriz", 2: "Filial", 3: "Serviços" };
export const NOME_DA_VENDA: Record<Venda, string> = { GLOBAL: "Global", MERCANTIL: "Mercantil" };

/** As contas da DRE que as premissas usam. */
const C = {
  RBPF: "ROB.RBPF.RECEITA_BRUTA_DO_PRE_FABRICADO",
  RBF: "ROB.RBF.RECEITA_BRUTA_DE_FRETE",
  RBM: "ROB.RBM.RECEITA_BRUTA_DE_MONTAGEM",
  RBC: "ROB.RBC.RECEITA_BRUTA_COMPLEMENTAR",
  PRODUCAO_M3: "P.PRODUCAO_DO_PRE_FABRICADO_M",
  PRODUCAO_PISTAS: "P.PRODUCAO_DO_PRE_FABRICADO_PISTAS",
  METALURGIA_KG: "P.PRODUCAO_DA_METALURGIA_KG",
  EXPEDICAO_M3: "S.EXPEDICAO_DO_PRE_FABRICADO_M",
  MONTAGEM_M3: "S.MONTAGEM_DO_PRE_FABRICADO_M",
} as const;
/** A receita líquida de cada receita bruta. */
const LIQUIDA_DA_BRUTA: Record<string, string> = {
  [C.RBPF]: "ROL.RLPF.RECEITA_LIQUIDA_DO_PRE_FABRICADO",
  [C.RBF]: "ROL.RLF.RECEITA_LIQUIDA_DE_FRETE",
  [C.RBM]: "ROL.RLM.RECEITA_LIQUIDA_DE_MONTAGEM",
  [C.RBC]: "ROL.RLC.RECEITA_LIQUIDA_COMPLEMENTAR",
};
/**
 * Em Serviços, as linhas da receita de montagem (como as medições: Montagem e Vedação), com os custos na CSM; as
 * demais são complementares (a receita complementar e os custos na CSC).
 */
const LINHAS_DE_MONTAGEM = new Set(["MONTAGEM", "VEDAÇÃO"]);
const PISTAS = "m³ e pistas";

/** Uma linha de produto ou de obra do cadastro Linhas, na unidade dela. */
export type LinhaDoCadastro = { codigo: string; nome: string; unidade: UnidadePremissa; medida: string };

export async function linhasDoCadastro(): Promise<LinhaDoCadastro[]> {
  const linhas = await getPrismaClient().linha.findMany({ where: { ativo: true, tipo: { in: ["PRODUTO", "OBRA"] } }, orderBy: { ordem: "asc" }, include: { unidadeNegocio: { select: { codigo: true } } } });
  return linhas
    .filter((l) => UNIDADES_PREMISSAS.includes(l.unidadeNegocio?.codigo as UnidadePremissa))
    .map((l) => ({ codigo: l.codigo, nome: l.nome, unidade: l.unidadeNegocio!.codigo as UnidadePremissa, medida: l.unidadeMedida || "und" }));
}

/** Uma linha da tabela: uma premissa (digitada) ou um cálculo. */
export type LinhaPremissa = {
  chave: string;
  secao: string;
  /** A linha de produto ou de obra da premissa (o subtítulo na tabela); nula na Jornada, nos Ajustes e no Resultado. */
  grupo: string | null;
  rotulo: string;
  und: string;
  tipo: "PREMISSA" | "CALCULO";
  casas: number;
};

/** As contas de custo e de DVV de uma linha: as da unidade (em Serviços, as da CSM ou da CSC, pela natureza da linha). */
function contasDaLinha(est: LinhaEstrutura[], l: LinhaDoCadastro) {
  const daUnidade = (prefixo: string) => est.filter((x) => x.tipo === "ITEM" && x.unidades.includes(l.unidade) && x.codigo.startsWith(prefixo));
  const custo = l.unidade === 3 ? (LINHAS_DE_MONTAGEM.has(l.codigo) ? "CSM" : "CSC") : "CPP";
  return {
    receitas: l.unidade === 3 ? [LINHAS_DE_MONTAGEM.has(l.codigo) ? C.RBM : C.RBC] : [C.RBPF, C.RBF],
    custos: [...daUnidade(`${custo}.MP.`), ...daUnidade(`${custo}.GGV.`), ...daUnidade(`${custo}.E.`)],
    dvv: daUnidade("DVV.GGV."),
  };
}

const pistas = (l: LinhaDoCadastro) => l.medida === PISTAS;
/** A unidade dos valores da linha: o m³ nas de pistas; a da linha nas demais. */
const undDoValor = (l: LinhaDoCadastro) => (pistas(l) ? "m³" : l.medida);
const nomeDaLinha = (l: LinhaDoCadastro) => `${l.nome} (${l.medida})`;

/** As linhas de uma tabela (unidade e venda), na ordem da tela. */
export function linhasDaTabela(est: LinhaEstrutura[], linhas: LinhaDoCadastro[], unidade: UnidadePremissa): LinhaPremissa[] {
  const daUnidade = linhas.filter((l) => l.unidade === unidade);
  const descricao = new Map(est.map((x) => [x.codigo, x.descricao]));
  const r: LinhaPremissa[] = [];
  const add = (secao: string, grupo: string | null, chave: string, rotulo: string, und: string, tipo: LinhaPremissa["tipo"] = "PREMISSA", casas = 2) =>
    r.push({ chave, secao, grupo, rotulo, und, tipo, casas });
  add("JORNADA", null, "DIAS_UTEIS", "Dias Úteis", "dia", "PREMISSA", 0);
  add("AJUSTES", null, "AJUSTE_RECEITA", "Ajuste sobre a Receita Bruta e Líquida", "%");
  add("AJUSTES", null, "AJUSTE_CUSTOS", "Ajuste sobre os Custos e Despesas", "%");
  for (const l of daUnidade) {
    const g = nomeDaLinha(l);
    if (pistas(l)) {
      add("PRODUÇÃO E SERVIÇOS", g, `DEMANDA:${l.codigo}`, "Demanda Diária", "pistas/dia");
      add("PRODUÇÃO E SERVIÇOS", g, `M3_PISTA:${l.codigo}`, "Volume por Pista", "m³/pista");
      add("PRODUÇÃO E SERVIÇOS", g, `VOLUME_PISTAS:${l.codigo}`, "Pistas no Mês", "pistas", "CALCULO");
      add("PRODUÇÃO E SERVIÇOS", g, `VOLUME:${l.codigo}`, "Volume no Mês", "m³", "CALCULO");
    } else {
      add("PRODUÇÃO E SERVIÇOS", g, `DEMANDA:${l.codigo}`, "Demanda Diária", `${l.medida}/dia`);
      add("PRODUÇÃO E SERVIÇOS", g, `VOLUME:${l.codigo}`, "Volume no Mês", l.medida, "CALCULO");
    }
  }
  for (const l of daUnidade) {
    const g = nomeDaLinha(l);
    const u = undDoValor(l);
    for (const c of contasDaLinha(est, l).receitas) add("RECEITA OPERACIONAL", g, `RB:${l.codigo}:${c}`, `Receita Bruta Média: ${descricao.get(c)?.replace(/^Receita Bruta (d[eoa]s? )?/i, "") ?? c}`, `R$/${u}`);
    add("RECEITA OPERACIONAL", g, `IMPOSTOS:${l.codigo}`, "Impostos Operacionais", "%/ROB");
    add("RECEITA OPERACIONAL", g, `RL:${l.codigo}`, "Receita Líquida Média", `R$/${u}`, "CALCULO");
  }
  const secaoCustos = unidade === 3 ? "CUSTOS DE SERVIÇOS" : "CUSTOS DE PRODUÇÃO";
  for (const l of daUnidade) {
    const g = nomeDaLinha(l);
    for (const c of contasDaLinha(est, l).custos) add(secaoCustos, g, `CUSTO:${l.codigo}:${c.codigo}`, `${rotuloAtribuicao(c.codigo)}: ${c.descricao}`, `R$/${undDoValor(l)}`);
  }
  for (const l of daUnidade) {
    const g = nomeDaLinha(l);
    for (const c of contasDaLinha(est, l).dvv) add("DESPESAS VARIÁVEIS DE VENDA", g, `CUSTO:${l.codigo}:${c.codigo}`, `GGV: ${c.descricao}`, `R$/${undDoValor(l)}`);
  }
  for (const [chave, rotulo] of RESULTADOS) add("RESULTADO DAS PREMISSAS", null, chave, rotulo, "R$", "CALCULO");
  return r;
}

const rotuloAtribuicao = (codigo: string) => (/\.MP\./.test(codigo) ? "MP" : /\.GGV\./.test(codigo) ? "GGV" : /\.E\./.test(codigo) ? "Estoque" : "");

/** O resultado da tabela em R$, mês a mês (o que ela leva para a DRE), pelos prefixos das contas. */
const RESULTADOS: Array<[string, string]> = [
  ["RESULTADO:ROB", "Receita Bruta"],
  ["RESULTADO:ROL", "Receita Líquida"],
  ["RESULTADO:MP", "Matérias Primas"],
  ["RESULTADO:GGV", "Gastos Gerais Variáveis"],
  ["RESULTADO:E", "Estoque"],
  ["RESULTADO:DVV", "Despesas Variáveis de Venda"],
];
const resultadoDaConta = (codigo: string) =>
  codigo.startsWith("ROB.") ? "RESULTADO:ROB" : codigo.startsWith("ROL.") ? "RESULTADO:ROL" : codigo.startsWith("DVV.") ? "RESULTADO:DVV" : /\.MP\./.test(codigo) ? "RESULTADO:MP" : /\.GGV\./.test(codigo) ? "RESULTADO:GGV" : /\.E\./.test(codigo) ? "RESULTADO:E" : null;

/** Lê uma premissa gravada (o mês 0 é a Média de Referência); sem valor gravado, undefined. */
export type Leitor = (chave: string, mes: number) => number | undefined;

/**
 * O cálculo de uma tabela: os valores de cada linha mês a mês (a premissa — a gravada ou o padrão — ou o cálculo), a
 * Média de Referência (a gravada; nos cálculos, a conta sobre as médias) e as contas da DRE que ela gera.
 */
export function calcularTabela(est: LinhaEstrutura[], linhas: LinhaDoCadastro[], unidade: UnidadePremissa, ano: number, ler: Leitor) {
  const daUnidade = linhas.filter((l) => l.unidade === unidade);
  const meses = Array.from({ length: 12 }, (_, k) => k + 1);
  const valores = new Map<string, Array<number | null>>();
  const referencia = new Map<string, number | null>();
  const dre = new Map<string, number[]>();
  const somar = (codigo: string, mes: number, v: number) => {
    if (!v) return;
    const lista = dre.get(codigo) ?? Array<number>(12).fill(0);
    lista[mes - 1] += v;
    dre.set(codigo, lista);
  };
  const premissa = (chave: string, padrao: (mes: number) => number = () => 0) => {
    const lista = meses.map((m) => ler(chave, m) ?? padrao(m));
    valores.set(chave, lista);
    referencia.set(chave, ler(chave, 0) ?? null);
    return lista;
  };
  const dias = premissa("DIAS_UTEIS", (m) => diasUteis(ano, m));
  const ajusteReceita = premissa("AJUSTE_RECEITA").map((p) => 1 + p / 100);
  const ajusteCustos = premissa("AJUSTE_CUSTOS").map((p) => 1 + p / 100);
  for (const l of daUnidade) {
    const demanda = premissa(`DEMANDA:${l.codigo}`);
    let volume: number[];
    if (pistas(l)) {
      const porPista = premissa(`M3_PISTA:${l.codigo}`);
      const qtd = demanda.map((d, k) => d * dias[k]);
      valores.set(`VOLUME_PISTAS:${l.codigo}`, qtd);
      volume = qtd.map((p, k) => p * porPista[k]);
      meses.forEach((m) => somar(C.PRODUCAO_PISTAS, m, qtd[m - 1]));
    } else {
      volume = demanda.map((d, k) => d * dias[k]);
    }
    valores.set(`VOLUME:${l.codigo}`, volume);
    // Os volumes da DRE: a produção (m³, e a expedição igual a ela) e a metalurgia nas fábricas; a montagem em Serviços.
    for (const m of meses) {
      const v = volume[m - 1];
      if (l.unidade !== 3 && (l.medida === "m³" || pistas(l))) {
        somar(C.PRODUCAO_M3, m, v);
        somar(C.EXPEDICAO_M3, m, v);
      } else if (l.unidade !== 3 && l.medida === "kg") somar(C.METALURGIA_KG, m, v);
      else if (l.unidade === 3 && l.codigo === "MONTAGEM") somar(C.MONTAGEM_M3, m, v);
    }
    const contas = contasDaLinha(est, l);
    const impostos = premissa(`IMPOSTOS:${l.codigo}`);
    const liquida = Array<number>(12).fill(0);
    let liquidaRef: number | null = null;
    for (const c of contas.receitas) {
      const unitario = premissa(`RB:${l.codigo}:${c}`);
      for (const m of meses) {
        const bruta = volume[m - 1] * unitario[m - 1] * ajusteReceita[m - 1];
        somar(c, m, bruta);
        somar(LIQUIDA_DA_BRUTA[c], m, bruta * (1 - impostos[m - 1] / 100));
        liquida[m - 1] += unitario[m - 1] * (1 - impostos[m - 1] / 100);
      }
      const rb = referencia.get(`RB:${l.codigo}:${c}`);
      if (rb !== null && rb !== undefined) liquidaRef = (liquidaRef ?? 0) + rb * (1 - (referencia.get(`IMPOSTOS:${l.codigo}`) ?? 0) / 100);
    }
    valores.set(`RL:${l.codigo}`, liquida);
    referencia.set(`RL:${l.codigo}`, liquidaRef);
    for (const c of [...contas.custos, ...contas.dvv]) {
      const unitario = premissa(`CUSTO:${l.codigo}:${c.codigo}`);
      for (const m of meses) somar(c.codigo, m, volume[m - 1] * unitario[m - 1] * ajusteCustos[m - 1]);
    }
  }
  // O resultado da tabela em R$.
  for (const [chave] of RESULTADOS) valores.set(chave, Array<number>(12).fill(0));
  for (const [codigo, lista] of dre) {
    const r = resultadoDaConta(codigo);
    if (r) lista.forEach((v, k) => (valores.get(r)![k]! += v));
  }
  return { valores, referencia, dre };
}

/**
 * Recalcula a DRE do cenário analítico (13/10/2026): as contas das premissas de cada unidade (as de Global e Mercantil
 * somadas) e as dos centros de custo, alocadas às unidades pelo balde e pelos rateios (centrosCenario.ts), substituem a
 * DRE inteira do cenário, e os totais e o Consolidado se recalculam pela Estrutura da DRE. Como a DRE do analítico não
 * se edita, ela é sempre a soma do que as premissas e os centros dão.
 */
export async function calcularAnalitico(tx: Tx, cenarioId: string) {
  const cenario = await tx.cenario.findUniqueOrThrow({ where: { id: cenarioId }, select: { ano: true } });
  const [est, linhas, gravadas, centros, valoresCentros, realizado] = await Promise.all([
    estrutura(),
    linhasDoCadastro(),
    tx.cenarioPremissa.findMany({ where: { cenarioId } }),
    centrosDoCadastro(),
    tx.cenarioCentro.findMany({ where: { cenarioId }, include: { linhaDRE: { select: { codigo: true } } } }),
    percentuaisDoRealizado(),
  ]);
  const porCodigo = new Map(est.map((l) => [l.codigo, l]));
  const dados = new Map(gravadas.map((p) => [`${p.unidade}|${p.venda}|${p.chave}|${p.mes}`, Number(p.valor)]));
  // Por unidade, conta e mês.
  const somas = new Map<string, number[]>();
  const somar = (u: number, codigo: string, lista: number[]) => {
    const s = somas.get(`${u}|${codigo}`) ?? Array<number>(12).fill(0);
    lista.forEach((x, k) => (s[k] += x));
    somas.set(`${u}|${codigo}`, s);
  };
  for (const u of UNIDADES_PREMISSAS) {
    for (const v of VENDAS_DA_UNIDADE[u]) {
      const { dre } = calcularTabela(est, linhas, u, cenario.ano, (chave, mes) => dados.get(`${u}|${v}|${chave}|${mes}`));
      for (const [codigo, lista] of dre) somar(u, codigo, lista);
    }
  }
  // Os centros de custo: a Produção rateada pelo m³ produzido do cenário em cada mês.
  const m3 = (u: number) => somas.get(`${u}|${C.PRODUCAO_M3}`) ?? Array<number>(12).fill(0);
  const percentuais = percentuaisDoCenario(realizado.percentuais, m3(1), m3(2));
  const alocados = alocarCentros(
    est,
    centros,
    valoresCentros.map((x) => ({ centroId: x.centroCustoId, codigo: x.linhaDRE.codigo, mes: x.mes, valor: Number(x.valor) })),
    percentuais,
  );
  for (const [k, lista] of alocados) {
    const [u, codigo] = k.split("|");
    somar(Number(u), codigo, lista);
  }
  const novos: Array<{ cenarioId: string; visao: number; linhaDREId: string; mes: number; valor: Prisma.Decimal }> = [];
  for (const [k, lista] of somas) {
    const [us, codigo] = k.split("|");
    const u = Number(us);
    const l = porCodigo.get(codigo);
    if (!l || l.tipo !== "ITEM" || !l.unidades.includes(u)) continue;
    lista.forEach((x, m) => {
      if (Math.abs(x) >= 0.00005) novos.push({ cenarioId, visao: u, linhaDREId: l.id, mes: m + 1, valor: new Prisma.Decimal(x.toFixed(4)) });
    });
  }
  await tx.cenarioResultado.deleteMany({ where: { cenarioId } });
  for (let i = 0; i < novos.length; i += 500) await tx.cenarioResultado.createMany({ data: novos.slice(i, i + 500) });
  await recalcular(tx, cenarioId, Array.from({ length: 12 }, (_, k) => k + 1), UNIDADES, est);
}
