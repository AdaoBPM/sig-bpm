import { strFromU8, unzipSync } from "fflate";

/**
 * Leitor mínimo de .xlsx, só leitura, só valores.
 *
 * Existe porque as planilhas do SIG são grandes e o Excel grava as abas antes
 * da tabela de textos compartilhados: um leitor em streaming teria de guardar a
 * aba inteira esperando os textos chegarem. Aqui o zip é aberto por acesso
 * direto — descompacta-se só a tabela de textos e a aba pedida, e as demais
 * abas do arquivo (o LISTAS REALIZADO (RESULTADOS) tem 230 MB de XML) nem são tocadas.
 *
 * Fórmulas não são avaliadas: vale o último valor que o Excel gravou.
 */

export type ValorCelula = string | number | boolean | null;

export type LinhaPlanilha = {
  /** Número da linha no Excel, a partir de 1. */
  numero: number;
  /** Valores por coluna: índice 0 é a coluna A. Colunas vazias ficam null. */
  celulas: ValorCelula[];
};

export type AbaLida = {
  nome: string;
  linhas: LinhaPlanilha[];
};

/** O arquivo não é um .xlsx legível — vira recusa do arquivo, não erro 500. */
export class ArquivoInvalidoError extends Error {}

type Pacote = Record<string, Uint8Array>;

function abrir(buffer: Uint8Array, caminhos: Set<string>): Pacote {
  try {
    return unzipSync(buffer, { filter: (f) => caminhos.has(f.name) });
  } catch {
    throw new ArquivoInvalidoError(
      "O arquivo não é uma planilha .xlsx válida. Salve-o no Excel como " +
        "\"Pasta de Trabalho do Excel (.xlsx)\" e envie de novo.",
    );
  }
}

function decodificar(texto: string): string {
  return texto
    .replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
      switch (e.toLowerCase()) {
        case "lt": return "<";
        case "gt": return ">";
        case "amp": return "&";
        case "quot": return "\"";
        case "apos": return "'";
      }
      const n = e[1] === "x" || e[1] === "X"
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10);
      return String.fromCodePoint(n);
    })
    // O Excel escapa caracteres de controle como _xHHHH_.
    .replace(/_x([0-9a-f]{4})_/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

function atributos(trecho: string): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const m of trecho.matchAll(/([\w:]+)="([^"]*)"/g)) {
    saida[m[1]] = decodificar(m[2]);
  }
  return saida;
}

/** Concatena os <t> de um trecho, ignorando a guia fonética (<rPh>). */
function textoDe(trecho: string): string {
  const semFonetica = trecho.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let saida = "";
  for (const m of semFonetica.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)) {
    saida += m[1] ?? "";
  }
  return decodificar(saida);
}

function indiceColuna(referencia: string): number {
  let n = 0;
  for (const ch of referencia) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Nome da aba → caminho da parte XML dentro do zip. */
function mapaDeAbas(pacote: Pacote): Map<string, string> {
  const workbook = pacote["xl/workbook.xml"];
  const rels = pacote["xl/_rels/workbook.xml.rels"];
  if (!workbook || !rels) {
    throw new ArquivoInvalidoError(
      "O arquivo não tem a estrutura de uma planilha do Excel.",
    );
  }

  const alvos = new Map<string, string>();
  for (const m of strFromU8(rels).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const a = atributos(m[1]);
    if (!a.Id || !a.Target) continue;
    const alvo = a.Target.startsWith("/")
      ? a.Target.slice(1)
      : `xl/${a.Target.replace(/^\.\//, "")}`;
    alvos.set(a.Id, alvo);
  }

  const abas = new Map<string, string>();
  for (const m of strFromU8(workbook).matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const a = atributos(m[1]);
    const alvo = alvos.get(a["r:id"] ?? "");
    if (a.name && alvo) abas.set(a.name, alvo);
  }
  return abas;
}

function textosCompartilhados(xml: Uint8Array | undefined): string[] {
  if (!xml) return [];
  const textos: string[] = [];
  for (const m of strFromU8(xml).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) {
    textos.push(m[1] ? textoDe(m[1]) : "");
  }
  return textos;
}

function valorDaCelula(
  atrib: Record<string, string>,
  conteudo: string,
  textos: string[],
): ValorCelula {
  const tipo = atrib.t ?? "n";
  if (tipo === "inlineStr") {
    const is = conteudo.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1];
    return is === undefined ? null : textoDe(is);
  }

  const bruto = conteudo.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
  if (bruto === undefined) return null;

  switch (tipo) {
    case "s":
      return textos[Number(bruto)] ?? null;
    case "b":
      return bruto === "1";
    case "str":
    case "e":
    case "d":
      return decodificar(bruto);
    default: {
      const n = Number(bruto);
      return Number.isFinite(n) ? n : decodificar(bruto);
    }
  }
}

function linhasDaAba(xml: string, textos: string[]): LinhaPlanilha[] {
  const linhas: LinhaPlanilha[] = [];
  let ultimaLinha = 0;

  for (const m of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(atributos(m[1]).r) || ultimaLinha + 1;
    ultimaLinha = numero;
    if (!m[2]) continue;

    const celulas: ValorCelula[] = [];
    let ultimaColuna = -1;
    for (const c of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const atrib = atributos(c[1]);
      const coluna = atrib.r ? indiceColuna(atrib.r) : ultimaColuna + 1;
      ultimaColuna = coluna;
      const valor = c[2] ? valorDaCelula(atrib, c[2], textos) : null;
      if (valor === null) continue;
      while (celulas.length < coluna) celulas.push(null);
      celulas[coluna] = valor;
    }
    if (celulas.length > 0) linhas.push({ numero, celulas });
  }
  return linhas;
}

/** Nomes das abas, na ordem do arquivo. */
export function listarAbas(buffer: Uint8Array): string[] {
  const pacote = abrir(
    buffer,
    new Set(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]),
  );
  return [...mapaDeAbas(pacote).keys()];
}

/**
 * Lê uma aba. `escolher` recebe os nomes das abas e devolve qual ler, ou null
 * quando nenhuma serve — caso em que a leitura é recusada com a lista de abas
 * encontradas, para a mensagem dizer ao usuário o que havia no arquivo.
 */
export function lerAba(
  buffer: Uint8Array,
  escolher: (abas: string[]) => string | null,
): AbaLida {
  const estrutura = abrir(
    buffer,
    new Set(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"]),
  );
  const abas = mapaDeAbas(estrutura);
  const nome = escolher([...abas.keys()]);
  const caminho = nome ? abas.get(nome) : undefined;
  if (!nome || !caminho) {
    throw new ArquivoInvalidoError(
      `Nenhuma aba do arquivo tem o formato esperado. Abas encontradas: ${[...abas.keys()].join(", ")}.`,
    );
  }

  const pacote = abrir(buffer, new Set([caminho, "xl/sharedStrings.xml"]));
  const aba = pacote[caminho];
  if (!aba) {
    throw new ArquivoInvalidoError(`A aba "${nome}" está vazia ou corrompida.`);
  }

  return {
    nome,
    linhas: linhasDaAba(strFromU8(aba), textosCompartilhados(pacote["xl/sharedStrings.xml"])),
  };
}
