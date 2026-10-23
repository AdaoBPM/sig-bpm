import { getPrismaClient } from "../../config/prisma.js";
import { DEFINICOES_INDICADORES } from "../importacoes/indicadores/leituraIndicadores.js";
import { LINHAS_TOTAIS } from "../volumes/totaisOperacao.js";
import { compilarFormula, formulaPorExtenso, type Item } from "./formulaIndicador.js";
import { CALCULOS_SISTEMA, type DadosDoMes, type Indicador } from "./indicadores.js";

/**
 * O catálogo dos indicadores, lido do cadastro Estrutura dos Indicadores (11/10/2026): cada indicador com a fórmula
 * compilada (ou, nos de cálculo do sistema, a conta do código) e o modo do acumulado.
 */

/** Os totais das Listas que somam uma lista inteira (o "Total" de Projetos, Pré-Fabricado, Metalurgia…). */
export const TOTAIS_SINTETICOS: Record<string, { rotulo: string; medida: string; codigos: string[] }> = {
  PROJETOS_TOTAL: { rotulo: "Projetos Liberados: Total", medida: "m³", codigos: ["PROJETOS_MATRIZ", "PROJETOS_FILIAL"] },
  PREFABRICADO_TOTAL: { rotulo: "Pré-Fabricado: Total", medida: "m³", codigos: ["PREFABRICADO_MATRIZ", "PREFABRICADO_FILIAL"] },
  METALURGIA_TOTAL: { rotulo: "Metalurgia: Total", medida: "kg", codigos: ["METALURGIA_MATRIZ", "METALURGIA_FILIAL", "METALURGIA_MONTAGEM", "METALURGIA_COMPLEMENTAR"] },
  ARMADURA_TOTAL: { rotulo: "Armadura: Total", medida: "kg", codigos: ["ARMADURA_MATRIZ", "ARMADURA_FILIAL", "ARMADURA_MONTAGEM", "ARMADURA_COMPLEMENTAR"] },
  EXPEDICAO_TOTAL: { rotulo: "Expedição: Total", medida: "m³", codigos: ["EXPEDICAO_MATRIZ", "EXPEDICAO_FILIAL"] },
  ACOMPANHAMENTO_TOTAL: { rotulo: "Acompanhamento: Total", medida: "d", codigos: ["ACOMPANHAMENTO_MONTAGEM", "ACOMPANHAMENTO_COMPLEMENTAR"] },
};

/** Os totalizadores das Listas que a fórmula pode usar: os da faixa de cada lista e os totais de cada lista. */
export const TOTALIZADORES_DAS_LISTAS: Array<{ codigo: string; rotulo: string }> = [
  ...LINHAS_TOTAIS.map((t) => ({ codigo: t.codigo as string, rotulo: `${t.rotulo.replace(/^\([PS]\) /, "")} (${t.medida})` })),
  ...Object.entries(TOTAIS_SINTETICOS).map(([codigo, t]) => ({ codigo, rotulo: `${t.rotulo} (${t.medida})` })),
];

/** Os indicadores do Comercial e do Administrativo (importados ou digitados nas Listas). */
export const INDICADORES_DAS_LISTAS = [...DEFINICOES_INDICADORES.INDICADORES_COMERCIAL.nomes, ...DEFINICOES_INDICADORES.INDICADORES_ADMIN.nomes];

const NOME_DA_VISAO: Record<number, string> = { 0: "Consolidado", 1: "Matriz", 2: "Filial", 3: "Serviços", 4: "Despesas e Extra", 5: "RN" };

/** O nome de cada item, para a fórmula por extenso. */
export async function rotulosDosItens() {
  const linhas = new Map((await getPrismaClient().linhaDRE.findMany({ select: { codigo: true, descricao: true } })).map((l) => [l.codigo, l.descricao]));
  const listas = new Map(TOTALIZADORES_DAS_LISTAS.map((t) => [t.codigo, t.rotulo]));
  return (i: Item) =>
    i.tipo === "DRE"
      ? `${linhas.get(i.codigo) ?? i.codigo} (${NOME_DA_VISAO[i.unidade] ?? i.unidade})`
      : i.tipo === "LISTA"
        ? `${listas.get(i.codigo) ?? i.codigo} [Listas]`
        : i.tipo === "META"
          ? `Meta: ${i.nome}`
          : i.nome;
}

/** Os valores de outros indicadores já contados em cada mês, e os que estão sendo contados (um ciclo fica sem valor). */
const contados = new WeakMap<DadosDoMes, Map<string, number | null>>();
const contando = new WeakMap<DadosDoMes, Set<string>>();

/** O valor do mês de outro indicador (o item [INDICADOR], 23/10/2026): o que os dados do mês dão ou a conta dele. */
function valorDoIndicador(m: DadosDoMes, nome: string, irmaos?: Map<string, Indicador>): number {
  const dado = m.indicador?.(nome);
  if (dado !== undefined) return dado ?? NaN;
  const memo = contados.get(m) ?? new Map<string, number | null>();
  contados.set(m, memo);
  if (memo.has(nome)) return memo.get(nome) ?? NaN;
  const outro = irmaos?.get(nome);
  const emCurso = contando.get(m) ?? new Set<string>();
  contando.set(m, emCurso);
  if (!outro || emCurso.has(nome)) return NaN;
  emCurso.add(nome);
  try {
    const v = outro.calculo(m).valor;
    memo.set(nome, v);
    return v ?? NaN;
  } finally {
    emCurso.delete(nome);
  }
}

/** O valor de um item no mês (NaN sem dado). */
function valorDoItem(m: DadosDoMes, i: Item, irmaos?: Map<string, Indicador>): number {
  switch (i.tipo) {
    case "DRE":
      return m.dre(i.unidade, i.codigo);
    case "LISTA":
      return m.lista ? m.lista(i.codigo) : m.volume(i.codigo);
    case "IND":
      return m.importado(i.nome) ?? NaN;
    case "META":
      return m.meta?.(i.nome) ?? NaN;
    case "INDICADOR":
      return valorDoIndicador(m, i.nome, irmaos);
  }
}

export type LinhaEstruturaIndicador = {
  grupo: string;
  numero: string;
  nome: string;
  sentido: string;
  unidade: string;
  descricao: string | null;
  formula: string | null;
  modo: string;
  peso: string | null;
};

/** Um indicador do cadastro pronto para calcular; `irmaos`: os indicadores pelo nome, para o item [INDICADOR]. */
export function montarIndicador(r: LinhaEstruturaIndicador, irmaos?: Map<string, Indicador>): Indicador {
  const base = { grupo: r.grupo, numero: r.numero, nome: r.nome, sentido: r.sentido, unidade: r.unidade, metodologia: r.descricao ?? "" };
  if (r.modo === "SISTEMA" || !r.formula) {
    const s = CALCULOS_SISTEMA[r.nome];
    return { ...base, acumulado: s?.acumulado ?? "ACUM", calculo: s?.calculo ?? (() => ({ valor: null })) };
  }
  const f = compilarFormula(r.formula);
  const peso = r.modo === "MEDIA_PONDERADA" && r.peso ? compilarFormula(r.peso) : null;
  const itens = [...f.itens];
  return {
    ...base,
    acumulado: r.modo === "ULTIMO" ? "ATUAL" : "ACUM",
    calculo: (m) => {
      const valores = new Map(itens.map(([chave, item]) => [chave, valorDoItem(m, item, irmaos)]));
      const valor = f.avaliar((k) => valores.get(k) ?? NaN);
      if (peso) {
        const p = peso.avaliar((k) => {
          const it = peso.itens.get(k);
          return it ? valorDoItem(m, it, irmaos) : NaN;
        });
        return { valor, peso: p ?? undefined };
      }
      return r.modo === "SOMA" ? { valor, operandos: Object.fromEntries(valores) } : { valor };
    },
    // Soma dos meses: a fórmula sobre a soma de cada item nos meses com valor.
    reavaliar: r.modo === "SOMA" ? (somas) => f.avaliar((k) => somas[k] ?? NaN) : undefined,
  };
}

/** Os indicadores das linhas, ligados uns aos outros pelo nome (o item [INDICADOR] da Metodologia, 23/10/2026). */
export function montarCatalogo(linhas: LinhaEstruturaIndicador[]): Indicador[] {
  const irmaos = new Map<string, Indicador>();
  const todos = linhas.map((r) => montarIndicador(r, irmaos));
  for (const i of todos) irmaos.set(i.nome, i);
  return todos;
}

/** Os indicadores ativos do cadastro, na ordem da tela (um inativo usado na Metodologia de outro ainda se conta). */
export async function catalogoDeIndicadores(): Promise<Indicador[]> {
  const linhas = await getPrismaClient().indicadorEstrutura.findMany({ orderBy: { ordem: "asc" } });
  const todos = montarCatalogo(linhas);
  return todos.filter((_, k) => linhas[k].ativo);
}

/** A fórmula por extenso de cada indicador do cadastro (a coluna Metodologia da tela). */
export async function formulasPorExtenso(formulas: Array<string | null>) {
  const rotulo = await rotulosDosItens();
  return formulas.map((f) => {
    if (!f) return null;
    try {
      return formulaPorExtenso(f, rotulo);
    } catch {
      return f;
    }
  });
}
