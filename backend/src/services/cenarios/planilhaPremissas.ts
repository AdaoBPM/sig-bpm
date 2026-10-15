import { unzipSync } from "fflate";

import { ArquivoInvalidoError, lerAba, listarAbas, type ValorCelula } from "../../lib/xlsx.js";
import { ESTILO, type AbaEscrita, type Celula } from "../../lib/xlsxEscrita.js";
import { mesesAcima } from "./comparativoCenario.js";

/**
 * A planilha das premissas de um cenário analítico (15/10/2026): o Exportar Premissas (só Excel) e o Importar Valores.
 * Cada aba da tela vira uma aba da planilha (os centros de custo numa aba só, um por aba ou um arquivo por centro): a
 * coluna Código (a chave da linha, que não se altera), as colunas que descrevem a linha, a unidade, a Média de
 * Referência, os doze meses (em branco: o mês sem valor), Justificar? (Sim quando algum mês passa da variação máxima
 * da conta, do Comparativo, em relação à Média de Referência) e a Justificativa (texto livre). O Importar Valores lê os
 * meses e a Justificativa das linhas pela coluna Código; a Média de Referência e Justificar? não se importam.
 */

export type AbaDasPremissas = "1" | "2" | "3" | "centros" | "investimentos" | "extra" | "manuais";
export const ABAS_DAS_PREMISSAS: AbaDasPremissas[] = ["1", "2", "3", "centros", "investimentos", "extra", "manuais"];
export const NOME_DA_ABA: Record<AbaDasPremissas, string> = {
  "1": "Matriz",
  "2": "Filial",
  "3": "Serviços",
  centros: "Centros de Custo",
  investimentos: "Depreciação Base",
  extra: "Extra-Operacional",
  manuais: "Indicadores Manuais",
};
/** As colunas que descrevem a linha, em cada aba. */
const COLUNAS: Record<AbaDasPremissas, Array<[string, number]>> = {
  "1": [["Venda", 11], ["Seção", 24], ["Linha", 30], ["Premissa", 44]],
  "2": [["Venda", 11], ["Seção", 24], ["Linha", 30], ["Premissa", 44]],
  "3": [["Venda", 11], ["Seção", 24], ["Linha", 30], ["Premissa", 44]],
  centros: [["Grupo", 28], ["Atribuição", 26], ["Conta", 40]],
  investimentos: [["Unidade", 18], ["Conta", 44]],
  extra: [["Unidade", 18], ["Seção", 30], ["Conta", 44]],
  manuais: [["Grupo", 22], ["Indicador", 44]],
};

export type LinhaDaPlanilha = {
  aba: AbaDasPremissas;
  /** P|unidade|venda|premissa, C|grupo|conta, L|grupo, B|unidade|conta, X|unidade|conta ou I|indicador. */
  chave: string;
  descricao: string[];
  und: string;
  /** A conta da DRE (a variação máxima do Comparativo); nula nas linhas sem conta (volumes, dias úteis, quadros). */
  conta: string | null;
  limite: number | null;
  media: number | null;
  /** Os doze meses gravados; null: em branco. */
  meses: Array<number | null>;
  /** O valor é uma fração (0,25 = 25%): os indicadores em %. */
  percentual?: boolean;
  /** Nos centros de custo, o grupo (para separar os centros em abas ou arquivos). */
  grupo?: string;
  justificativa: string | null;
};

/** A aba das premissas de uma chave da planilha (a permissão de editar é a dela). */
export function abaDaChave(chave: string): AbaDasPremissas | null {
  const [tipo, u] = chave.split("|");
  if (tipo === "P") return u === "1" || u === "2" || u === "3" ? u : null;
  return ({ C: "centros", L: "centros", B: "investimentos", X: "extra", I: "manuais" } as const)[tipo as "C"] ?? null;
}

export const COLUNA_CODIGO = "Código (não altere)";
const COLUNA_MEDIA = "Média de Referência";
const COLUNA_JUSTIFICAR = "Justificar?";
const COLUNA_JUSTIFICATIVA = "Justificativa";

/**
 * Justificar? (como na aba Justificativas da tela Reajustes): Sim quando algum mês com valor passa da variação máxima da
 * conta em relação à Média de Referência. Sem média, sem variação máxima ou sem conta, Não.
 */
export function precisaJustificar(l: Pick<LinhaDaPlanilha, "limite" | "media" | "meses">) {
  if (l.limite === null || l.media === null) return false;
  const valores = new Map(l.meses.flatMap((v, k): Array<[number, number]> => (v === null ? [] : [[k + 1, v]])));
  const comparados = new Map([...valores.keys()].map((m): [number, number] => [m, l.media!]));
  return mesesAcima(valores, comparados, l.limite).length > 0;
}

/** Uma aba da planilha: o título, a explicação, os rótulos e as linhas. */
export function abaDaPlanilha(nome: string, aba: AbaDasPremissas, linhas: LinhaDaPlanilha[], meses: string[], identificacao: string): AbaEscrita {
  const cab = (valor: string): Celula => ({ valor, estilo: ESTILO.cabecalho });
  const cabDireita = (valor: string): Celula => ({ valor, estilo: ESTILO.cabecalhoDireita });
  const numero = (l: LinhaDaPlanilha, v: number | null): Celula => ({ valor: v, estilo: l.percentual ? ESTILO.itemPercentual : ESTILO.itemNumero });
  return {
    nome,
    larguras: [30, ...COLUNAS[aba].map(([, w]) => w), 10, 14, ...meses.map(() => 13), 12, 60],
    linhas: [
      [{ valor: `Premissas · ${nome}`, estilo: ESTILO.titulo }],
      [{ valor: identificacao, estilo: ESTILO.informacao }],
      [
        {
          valor:
            "Preencha os meses e a Justificativa e importe o arquivo em Premissas / Importar Valores. Em branco, o mês fica sem valor. A coluna Código identifica a linha: não a altere. A Média de Referência e Justificar? não se importam.",
          estilo: ESTILO.informacao,
        },
      ],
      [],
      [cab(COLUNA_CODIGO), ...COLUNAS[aba].map(([c]) => cab(c)), cab("Und."), cabDireita(COLUNA_MEDIA), ...meses.map(cabDireita), cab(COLUNA_JUSTIFICAR), cab(COLUNA_JUSTIFICATIVA)],
      ...linhas.map((l): Celula[] => [
        { valor: l.chave },
        ...l.descricao.map((d) => ({ valor: d })),
        { valor: l.und },
        numero(l, l.media),
        ...l.meses.map((v) => numero(l, v)),
        { valor: precisaJustificar(l) ? "Sim" : "Não" },
        { valor: l.justificativa },
      ]),
    ],
    linhaCabecalho: 5,
    rodape: `Premissas · ${nome}`,
    paisagem: true,
  };
}

/** Uma linha lida de um arquivo: a chave, os doze meses (null: em branco) e a justificativa. */
export type LinhaLida = { aba: string; numero: number; chave: string; meses: Array<number | null>; justificativa: string | null };
export type ArquivoLido = { arquivo: string; linhas: LinhaLida[]; abas: string[]; erros: string[]; avisos: string[] };

/** O número de uma célula: o do Excel ou um texto no formato brasileiro ("1.234,5", "25%"); vazio, null; inválido, undefined. */
function numeroDa(v: ValorCelula): number | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "boolean") return undefined;
  const t = v.trim();
  if (!t) return null;
  const pct = t.endsWith("%");
  const n = Number(t.replace(/%$/, "").replace(/R\$|\s/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  return pct ? n / 100 : n;
}

/** Lê um .xlsx do Exportar Premissas: as abas com a coluna Código; as outras são ignoradas, com um aviso. */
function lerXlsx(arquivo: string, buffer: Uint8Array): ArquivoLido {
  const r: ArquivoLido = { arquivo, linhas: [], abas: [], erros: [], avisos: [] };
  let abas: string[];
  try {
    abas = listarAbas(buffer);
  } catch (e) {
    r.erros.push(e instanceof ArquivoInvalidoError ? e.message : "O arquivo não é uma planilha do Excel (.xlsx) legível.");
    return r;
  }
  for (const nome of abas) {
    const { linhas } = lerAba(buffer, () => nome);
    const i = linhas.findIndex((l) => String(l.celulas[0] ?? "").trim() === COLUNA_CODIGO);
    if (i < 0) {
      r.avisos.push(`A aba ${nome} não está no padrão do Exportar Premissas (sem a coluna “${COLUNA_CODIGO}”) e foi ignorada.`);
      continue;
    }
    const rotulos = linhas[i].celulas.map((c) => String(c ?? "").trim());
    const iMedia = rotulos.indexOf(COLUNA_MEDIA);
    const iJustificativa = rotulos.indexOf(COLUNA_JUSTIFICATIVA);
    if (iMedia < 0 || iJustificativa < 0 || iJustificativa < iMedia + 13) {
      r.erros.push(`A aba ${nome} não tem as colunas do padrão (“${COLUNA_MEDIA}”, os doze meses e “${COLUNA_JUSTIFICATIVA}”).`);
      continue;
    }
    r.abas.push(nome);
    for (const l of linhas.slice(i + 1)) {
      const chave = String(l.celulas[0] ?? "").trim();
      if (!chave) continue;
      const meses: Array<number | null> = [];
      for (let k = 0; k < 12; k++) {
        const v = numeroDa(l.celulas[iMedia + 1 + k] ?? null);
        if (v === undefined) {
          r.erros.push(`${nome}, linha ${l.numero}, ${rotulos[iMedia + 1 + k] || `mês ${k + 1}`}: “${l.celulas[iMedia + 1 + k]}” não é um número.`);
          meses.push(null);
        } else meses.push(v);
      }
      const j = l.celulas[iJustificativa];
      r.linhas.push({ aba: nome, numero: l.numero, chave, meses, justificativa: j === null || j === undefined || String(j).trim() === "" ? null : String(j).trim().slice(0, 2000) });
    }
  }
  if (!r.abas.length && !r.erros.length) r.erros.push(`O arquivo não está no padrão do Exportar Premissas: nenhuma aba tem a coluna “${COLUNA_CODIGO}”.`);
  return r;
}

/** Lê um arquivo do Importar Valores: um .xlsx, ou um .zip (o "um arquivo por centro") com os .xlsx dentro. */
export function lerArquivoDePremissas(arquivo: string, buffer: Uint8Array): ArquivoLido[] {
  if (/\.zip$/i.test(arquivo)) {
    let itens: Record<string, Uint8Array>;
    try {
      itens = unzipSync(buffer);
    } catch {
      return [{ arquivo, linhas: [], abas: [], erros: ["O arquivo .zip não pôde ser aberto."], avisos: [] }];
    }
    const xlsx = Object.entries(itens).filter(([n]) => /\.xlsx$/i.test(n) && !n.startsWith("__MACOSX"));
    if (!xlsx.length) return [{ arquivo, linhas: [], abas: [], erros: ["O .zip não tem nenhuma planilha (.xlsx)."], avisos: [] }];
    return xlsx.map(([n, b]) => lerXlsx(`${arquivo} › ${n.split("/").pop()}`, b));
  }
  return [lerXlsx(arquivo, buffer)];
}
