/**
 * Ordenar e filtrar tabelas pelos rótulos das colunas, como no Excel. A
 * lógica fica aqui, sem React; a tela usa useTabelaFiltravel
 * (components/shared/TabelaFiltravel).
 */

export type TipoColuna = "texto" | "numero" | "data";

export type Coluna<T> = {
  chave: string;
  rotulo: string;
  /** O valor que ordena: número nas colunas de número e data, texto nas demais. */
  valor?: (linha: T) => string | number | null | undefined;
  /** O que aparece na lista do filtro e é comparado nele (o padrão é o valor). */
  texto?: (linha: T) => string | null | undefined;
  tipo?: TipoColuna;
  alinhamento?: "direita";
  /** Coluna de ações (editar, excluir): sem rótulo, sem filtro. */
  semFiltro?: boolean;
  /** Classe extra do <th> (largura, recuo). */
  classe?: string;
};

export type EstadoTabela = {
  ordem: { chave: string; decrescente: boolean } | null;
  /** Por coluna, os textos que ficam à mostra. Coluna sem entrada: sem filtro. */
  filtros: Record<string, string[]>;
};

export const ESTADO_INICIAL: EstadoTabela = { ordem: null, filtros: {} };

/** O rótulo das linhas sem valor na lista do filtro, como no Excel. */
export const VAZIAS = "(Vazias)";

export function textoDe<T>(c: Coluna<T>, linha: T): string {
  const t = c.texto ? c.texto(linha) : c.valor?.(linha);
  if (t === null || t === undefined || t === "") return VAZIAS;
  return typeof t === "number" ? t.toLocaleString("pt-BR") : String(t);
}

function valorDe<T>(c: Coluna<T>, linha: T): string | number | null {
  const v = c.valor ? c.valor(linha) : c.texto?.(linha);
  return v === undefined || v === "" ? null : v;
}

const colador = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** As linhas que passam nos filtros, menos o de uma coluna (para montar a lista dela). */
export function filtrar<T>(linhas: T[], colunas: Coluna<T>[], estado: EstadoTabela, exceto?: string): T[] {
  const ativos = colunas.filter((c) => c.chave !== exceto && estado.filtros[c.chave]);
  if (ativos.length === 0) return linhas;
  const conjuntos = ativos.map((c) => ({ c, s: new Set(estado.filtros[c.chave]) }));
  return linhas.filter((l) => conjuntos.every(({ c, s }) => s.has(textoDe(c, l))));
}

export function ordenar<T>(linhas: T[], colunas: Coluna<T>[], estado: EstadoTabela): T[] {
  const o = estado.ordem;
  const c = o ? colunas.find((x) => x.chave === o.chave) : undefined;
  if (!o || !c) return linhas;
  const sinal = o.decrescente ? -1 : 1;
  // Sem valor vai sempre para o fim, como no Excel.
  return [...linhas].sort((a, b) => {
    const va = valorDe(c, a);
    const vb = valorDe(c, b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * sinal;
    return colador.compare(String(va), String(vb)) * sinal;
  });
}

/** Os valores distintos de uma coluna, com a quantidade de linhas, na ordem da coluna. */
export function distintos<T>(linhas: T[], c: Coluna<T>): Array<{ texto: string; n: number }> {
  const m = new Map<string, { n: number; v: string | number | null }>();
  for (const l of linhas) {
    const t = textoDe(c, l);
    const x = m.get(t);
    if (x) x.n++;
    else m.set(t, { n: 1, v: valorDe(c, l) });
  }
  return [...m.entries()]
    .sort(([ta, a], [tb, b]) => {
      if (ta === VAZIAS) return 1;
      if (tb === VAZIAS) return -1;
      if (typeof a.v === "number" && typeof b.v === "number") return a.v - b.v;
      return colador.compare(ta, tb);
    })
    .map(([texto, x]) => ({ texto, n: x.n }));
}
