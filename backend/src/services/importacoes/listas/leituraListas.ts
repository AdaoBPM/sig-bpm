import { Prisma } from "../../../generated/prisma/client.js";
import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Peças comuns da leitura das listas operacionais. Cada lista tem o seu
 * leiaute (definicoesListas.ts); aqui ficam cabeçalho, datas, números e o
 * formato do resultado, iguais para todas.
 */

export type CodigoUnidade = 1 | 2 | 3;

export type RegistroLista = {
  linhaArquivo: number;
  obra: { codigo: string; nome: string | null } | null;
  /** Código da UnidadeNegocio: 1 Matriz, 2 Filial, 3 Serviços. */
  unidade: CodigoUnidade | null;
  linha: { tipo: "PRODUTO" | "OBRA"; codigo: string } | null;
  quantidade: Decimal;
  /** Campos próprios do modelo da lista, com os nomes do schema. */
  campos: Record<string, string | number | Date | Decimal | null>;
};

export type RejeicaoLista = {
  linha: number;
  codigo: "DATA_INVALIDA" | "UNIDADE_INVALIDA" | "LINHA_INVALIDA" | "QUANTIDADE_INVALIDA" | "VALOR_INVALIDO";
  mensagem: string;
};

export type LeituraLista =
  | { ok: false; motivo: string }
  | {
      ok: true;
      /** Todas as linhas abaixo do cabeçalho: aceitas + rejeitadas + ignoradas. */
      linhasLidas: number;
      registros: RegistroLista[];
      rejeicoes: RejeicaoLista[];
      /**
       * semEfeito: linhas que as fórmulas da planilha deixam de fora (sem
       * projeto, ou linha "-"), nas listas da receita prévia.
       */
      ignoradas: { vazias: number; outrosMeses: number; semEfeito?: number };
      /** Observações que não impedem a gravação. */
      avisos: string[];
    };

export const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function rotuloMes(ano: number, mes: number) {
  return `${MESES_CURTOS[mes - 1]}/${ano}`;
}

export function normalizar(v: ValorCelula | undefined): string {
  return v === null || v === undefined ? "" : String(v).trim().toUpperCase();
}

export function texto(v: ValorCelula | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Célula vazia no sentido das fórmulas da planilha: vazio ou zero. */
export function vazia(v: ValorCelula | undefined): boolean {
  return v === null || v === undefined || v === "" || v === 0 || v === "0";
}

/**
 * Número da célula. Vazio e "-" contam como zero, como nos SOMASES da
 * planilha; texto que não é número é erro (undefined).
 */
export function numero(v: ValorCelula | undefined): Decimal | undefined {
  if (v === null || v === undefined || v === "" || v === "-") return new Decimal(0);
  if (typeof v === "number") return new Decimal(v);
  const s = String(v).trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(s) ? new Decimal(s) : undefined;
}

/** Data de uma célula: número de série do Excel ou texto dd/mm/aaaa. */
export function data(v: ValorCelula | undefined): Date | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // O Excel conta dias desde 30/12/1899; a fração é a hora.
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86_400_000));
  }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  }
  return null;
}

export function mesmoMes(d: Date, ano: number, mes: number) {
  return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes;
}

/** "Unidade 01" → 1, "Unidade 02" → 2: o vocabulário das listas do Plannix. */
export function unidadeDoTexto(v: ValorCelula | undefined): CodigoUnidade | null {
  const m = normalizar(v).match(/^UNIDADE\s*0?([12])$/);
  return m ? (Number(m[1]) as CodigoUnidade) : null;
}

/**
 * Cabeçalho: a primeira das 10 primeiras linhas que tenha todas as colunas
 * obrigatórias. Devolve o índice de cada coluna pedida, obrigatória ou não.
 */
export function localizarCabecalho(
  linhas: LinhaPlanilha[],
  obrigatorias: string[],
  opcionais: string[] = [],
): { numero: number; col: Record<string, number> } | { erro: string } {
  for (const l of linhas.slice(0, 10)) {
    const nomes = l.celulas.map(normalizar);
    if (!obrigatorias.every((n) => nomes.includes(n))) continue;
    const col: Record<string, number> = {};
    for (const n of [...obrigatorias, ...opcionais]) col[n] = nomes.indexOf(n);
    return { numero: l.numero, col };
  }
  const primeira = linhas[0]?.celulas.map(normalizar) ?? [];
  const faltantes = obrigatorias.filter((n) => !primeira.includes(n));
  return {
    erro:
      `Cabeçalho não encontrado. Faltam as colunas: ${faltantes.join(", ")}. ` +
      "Confira se a aba enviada é a lista certa.",
  };
}

/**
 * Colunas de mês de um cabeçalho em matriz (armadura, metalurgia): a coluna
 * cujo cabeçalho é a data do mês da competência.
 */
export function colunaDoMes(
  cabecalho: ValorCelula[],
  ano: number,
  mes: number,
): number | { erro: string } {
  const encontrados: string[] = [];
  for (const [i, v] of cabecalho.entries()) {
    const d = data(v);
    if (!d) continue;
    encontrados.push(rotuloMes(d.getUTCFullYear(), d.getUTCMonth() + 1));
    if (mesmoMes(d, ano, mes)) return i;
  }
  return {
    erro:
      `O arquivo não traz a coluna de ${rotuloMes(ano, mes)}. ` +
      (encontrados.length ? `Meses encontrados: ${encontrados.join(", ")}.` : "Nenhum mês reconhecido no cabeçalho."),
  };
}

// ---------------------------------------------------------------------------

export type Resultado =
  | { tipo: "vazia" }
  | { tipo: "outroMes" }
  | { tipo: "semEfeito" }
  | { tipo: "rejeitada"; rejeicao: RejeicaoLista }
  | { tipo: "registros"; registros: RegistroLista[] };

/** Esqueleto comum: percorre as linhas abaixo do cabeçalho e contabiliza. */
export function percorrer(
  linhas: LinhaPlanilha[],
  cabecalho: number,
  ler: (l: LinhaPlanilha, c: (i: number) => ValorCelula) => Resultado,
  avisos: string[] = [],
): LeituraLista {
  const registros: RegistroLista[] = [];
  const rejeicoes: RejeicaoLista[] = [];
  const ignoradas = { vazias: 0, outrosMeses: 0, semEfeito: 0 };
  let linhasLidas = 0;
  for (const l of linhas) {
    if (l.numero <= cabecalho) continue;
    linhasLidas++;
    const r = ler(l, (i) => (i < 0 ? null : (l.celulas[i] ?? null)));
    if (r.tipo === "vazia") ignoradas.vazias++;
    else if (r.tipo === "outroMes") ignoradas.outrosMeses++;
    else if (r.tipo === "semEfeito") ignoradas.semEfeito++;
    else if (r.tipo === "rejeitada") rejeicoes.push(r.rejeicao);
    else if (r.registros.length === 0) ignoradas.vazias++;
    else registros.push(...r.registros);
  }
  return { ok: true, linhasLidas, registros, rejeicoes, ignoradas, avisos };
}

export const rejeitar = (linha: number, codigo: RejeicaoLista["codigo"], mensagem: string): Resultado => ({
  tipo: "rejeitada",
  rejeicao: { linha, codigo, mensagem },
});

export function obraDe(codigo: ValorCelula, nome: ValorCelula) {
  const c = texto(codigo);
  return c ? { codigo: c, nome: texto(nome) } : null;
}

