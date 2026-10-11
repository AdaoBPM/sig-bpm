import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";
import { getPrismaClient } from "../../../config/prisma.js";
import { ESTRUTURA_INICIAL_INDICADORES } from "../../relatorios/estruturaInicialIndicadores.js";

/**
 * Os nomes dos indicadores do cadastro Estrutura dos Indicadores, para a aba das metas (11/10/2026): um indicador
 * novo no cadastro já recebe a meta dele. Lidos do banco antes de cada análise e de cada importação; até lá, os da
 * carga inicial.
 */
let nomesDasMetas: string[] = ESTRUTURA_INICIAL_INDICADORES.map((i) => i.nome);
export async function atualizarNomesDasMetas() {
  const nomes = (await getPrismaClient().indicadorEstrutura.findMany({ select: { nome: true } })).map((i) => i.nome);
  if (nomes.length) nomesDasMetas = nomes;
}

/**
 * Indicadores gerenciais que não saem da DRE, importados mês a mês:
 *
 * - aba Indicadores (Admin.) do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO):
 *   o quadro de lotação, o fluxo de caixa, a inadimplência, o turnover, as
 *   vagas e os acidentes;
 * - aba Indicadores (Comercial) do CONTROLE DAS VENDAS - COMERCIAL: as vendas,
 *   a receita líquida vendida, a margem de contribuição das vendas, a demanda
 *   e o mix ampliado.
 *
 * E as metas do orçamento, da aba Metas (Orçamento) do INDICADORES DE
 * RESULTADO: o valor orçado de cada um dos indicadores do catálogo, a base do
 * "vs. Orçado" do Painel de Bordo.
 *
 * As abas têm o mesmo leiaute: a coluna INDICADOR (a primeira nas abas dos
 * indicadores; a segunda, depois de GRUPO, na das metas) e uma coluna por mês
 * (a data do dia 1º, ou JAN/2026). Cada linha é um indicador, pelo nome da aba
 * Realizado (SIG) do INDICADORES DE RESULTADO; o valor é o da coluna do mês da
 * competência.
 */

export type TipoIndicadores = "INDICADORES_ADMIN" | "INDICADORES_COMERCIAL" | "METAS_ORCAMENTO";

type Definicao = {
  aba: string;
  rotulo: string;
  nomes: string[];
  /** Onde o valor é gravado: os indicadores realizados ou as metas do orçamento. */
  destino: "INDICADOR" | "META";
  /** Outros nomes de um indicador na aba (o nome da aba → o do catálogo). */
  apelidos?: Record<string, string>;
  /** Linhas com nome fora do catálogo são ignoradas, e não rejeitadas (a aba das metas tem indicadores que a ferramenta não calcula). */
  ignorarOutros?: boolean;
};

export const DEFINICOES_INDICADORES: Record<TipoIndicadores, Definicao> = {
  INDICADORES_ADMIN: {
    aba: "Indicadores (Admin.)",
    rotulo: "Indicadores do Administrativo",
    destino: "INDICADOR",
    nomes: [
      "Quadro de Lotação: MO Direta Matriz",
      "Quadro de Lotação: MO Direta Filial",
      "Quadro de Lotação: MO Direta Total",
      "Quadro de Lotação: MO Indireta Matriz",
      "Quadro de Lotação: MO Indireta Filial",
      "Quadro de Lotação: MO Indireta Total",
      "Quadro de Lotação: MO Geral Matriz",
      "Quadro de Lotação: MO Geral Filial",
      "Quadro de Lotação: MO Geral Total",
      "Quadro de Lotação: MO Direta Montagem",
      "Quadro de Lotação: MO Indireta Montagem",
      "Quadro de Lotação: MO Geral Montagem",
      "Fluxo de Caixa Operacional Líquido",
      "Inadimplência",
      "Quadro de Lotação Total",
      "Turnover",
      "Abertura de Vagas x Contratações",
      "Acidentes c/ Afastamento",
    ],
  },
  INDICADORES_COMERCIAL: {
    aba: "Indicadores (Comercial)",
    rotulo: "Indicadores do Comercial",
    destino: "INDICADOR",
    nomes: [
      "Venda: Global",
      "Venda: Mercantil",
      "Venda: Total",
      "Receita Líquida Vendida: Global",
      "Receita Líquida Vendida: Mercantil",
      "Receita Líquida Vendida: Total",
      "Margem de Contribuição: Global",
      "Margem de Contribuição: Mercantil",
      "Margem de Contribuição: Total",
      "Demanda (Vol.): Matriz",
      "Demanda (Vol.): Filial",
      "Demanda (Vol.): Total (Fabricação)",
      "Demanda (Vol.): Montagem",
      "Demanda (Pistas.): Filial",
      "Repres. do Mix Ampliado nas Vendas",
    ],
  },
  METAS_ORCAMENTO: {
    aba: "Metas (Orçamento)",
    rotulo: "Metas do Orçamento",
    destino: "META",
    get nomes() {
      return nomesDasMetas;
    },
    apelidos: { "Quadro de Lotação": "Quadro de Lotação Total" },
    ignorarOutros: true,
  },
};

export const ehTipoIndicadores = (tipo: string): tipo is TipoIndicadores => tipo in DEFINICOES_INDICADORES;

/**
 * Os tipos que não entram na apuração: importá-los depois de apurar não muda
 * nenhum valor apurado, então não pede reapuração (nem acende a bola verde).
 */
export const TIPOS_FORA_DA_APURACAO = Object.keys(DEFINICOES_INDICADORES) as TipoIndicadores[];

export type ValorIndicador = { nome: string; valor: number; linhaArquivo: number };
export type Rejeicao = { linha: number; codigo: string; mensagem: string };
export type LeituraIndicadores =
  | { ok: true; valores: ValorIndicador[]; rejeicoes: Rejeicao[]; lidas: number; vazias: number }
  | { ok: false; motivo: string };

const normalizar = (v: ValorCelula) => String(v ?? "").trim().replace(/\s+/g, " ").toUpperCase();

/** O ano e o mês do rótulo de uma coluna: a data (serial do Excel ou texto dd/mm/aaaa) ou "AGO/2026". */
function mesDaColuna(v: ValorCelula): { ano: number; mes: number } | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
  }
  const t = String(v ?? "").trim().toUpperCase();
  const data = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (data) return { ano: Number(data[3]), mes: Number(data[2]) };
  const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const nome = t.match(/^([A-Z]{3})\/(\d{2}|\d{4})$/);
  if (nome && MESES.includes(nome[1])) return { ano: Number(nome[2].length === 2 ? `20${nome[2]}` : nome[2]), mes: MESES.indexOf(nome[1]) + 1 };
  return null;
}

const numero = (v: ValorCelula): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v ?? "").trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Lê o mês da aba: o valor de cada indicador do catálogo do tipo. Recusa a aba
 * sem o cabeçalho ou sem a coluna do mês; uma linha de indicador fora do
 * catálogo ou com valor que não é número é rejeitada (e relatada).
 */
export function lerIndicadores(tipo: TipoIndicadores, linhas: LinhaPlanilha[], ano: number, mes: number): LeituraIndicadores {
  const def = DEFINICOES_INDICADORES[tipo];
  const cabecalho = linhas.find((l) => l.celulas.slice(0, 3).some((v) => normalizar(v) === "INDICADOR"));
  if (!cabecalho) return { ok: false, motivo: `A aba não tem o cabeçalho (coluna INDICADOR). Envie a aba ${def.aba}.` };
  const colunaNome = cabecalho.celulas.findIndex((v) => normalizar(v) === "INDICADOR");
  const coluna = cabecalho.celulas.findIndex((v, i) => i > colunaNome && (() => {
    const m = mesDaColuna(v);
    return m !== null && m.ano === ano && m.mes === mes;
  })());
  if (coluna < 0) return { ok: false, motivo: `A aba não tem a coluna de ${String(mes).padStart(2, "0")}/${ano}.` };
  const catalogo = new Map([...def.nomes.map((n) => [normalizar(n), n] as const), ...Object.entries(def.apelidos ?? {}).map(([a, n]) => [normalizar(a), n] as const)]);
  const valores: ValorIndicador[] = [];
  const rejeicoes: Rejeicao[] = [];
  let lidas = 0;
  let vazias = 0;
  for (const l of linhas) {
    if (l.numero <= cabecalho.numero) continue;
    const nome = normalizar(l.celulas[colunaNome]);
    if (!nome) continue;
    lidas++;
    const bruto = l.celulas[coluna];
    if (bruto === null || String(bruto).trim() === "") {
      vazias++;
      continue;
    }
    const doCatalogo = catalogo.get(nome);
    if (!doCatalogo && def.ignorarOutros) {
      vazias++;
      continue;
    }
    if (!doCatalogo) {
      rejeicoes.push({ linha: l.numero, codigo: "INDICADOR_DESCONHECIDO", mensagem: `"${String(l.celulas[colunaNome]).trim()}" não é um indicador do catálogo.` });
      continue;
    }
    const v = numero(bruto);
    if (v === null) {
      rejeicoes.push({ linha: l.numero, codigo: "VALOR_INVALIDO", mensagem: `O valor de "${doCatalogo}" não é um número.` });
      continue;
    }
    valores.push({ nome: doCatalogo, valor: v, linhaArquivo: l.numero });
  }
  return { ok: true, valores, rejeicoes, lidas, vazias };
}
