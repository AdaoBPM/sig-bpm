import { Prisma } from "../../../generated/prisma/client.js";
import type { TipoImportacao } from "../../../generated/prisma/enums.js";
import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";
import {
  destinoDaArmadura,
  destinoDaFinalidade,
  UNIDADE_DO_DESTINO,
} from "./destinosVolume.js";
import {
  colunaDoMes,
  obraDe,
  percorrer,
  rejeitar,
  data,
  localizarCabecalho,
  mesmoMes,
  normalizar,
  numero,
  texto,
  unidadeDoTexto,
  vazia,
  type CodigoUnidade,
  type LeituraLista,
  type RegistroLista,
  type RejeicaoLista,
} from "./leituraListas.js";

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * Leiaute de cada lista operacional que alimenta os rateios, a partir das abas
 * do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO) e da Produção Mensal da planilha
 * da metalurgia.
 *
 * As colunas calculadas da planilha (Período, Linha, V. Adot., Etiqueta) são
 * refeitas aqui a partir das colunas de origem, com a regra das fórmulas: as
 * listas dos meses encerrados foram congeladas em valores, e quem digitar ou
 * exportar a lista do Plannix não terá essas colunas.
 */

export type TipoListaRateio = Extract<
  TipoImportacao,
  | "PROJETO"
  | "PRODUCAO"
  | "PRODUCAO_PISTA"
  | "PRODUCAO_ARMADURA"
  | "PRODUCAO_METALURGIA"
  | "EXPEDICAO"
  | "MONTAGEM"
  | "ACOMPANHAMENTO"
>;

export type DefinicaoLista = {
  tipo: TipoListaRateio;
  rotulo: string;
  /** Nomes de aba aceitos; se o arquivo tiver uma aba só, ela é usada. */
  abas: string[];
  interpretar: (linhas: LinhaPlanilha[], ano: number, mes: number) => LeituraLista;
};

/** Linha de produto de projetos e produção: pela unidade e pelo produto. */
function linhaDoProduto(unidade: CodigoUnidade, produto: string | null) {
  if (unidade === 1) return "ESTRUTURA";
  return normalizar(produto).includes("ESTACA") ? "ESTACAS" : "ALVEOLARES";
}

/** Linha da expedição: pelo nome da peça. */
export function linhaDaPeca(peca: string | null) {
  const p = normalizar(peca);
  if (p.startsWith("ESC")) return "ESTRUTURA";
  if (p.startsWith("E")) return "ESTACAS";
  if (p.startsWith("L") || p.startsWith("PA")) return "ALVEOLARES";
  return "ESTRUTURA";
}

/** Linha da montagem: pelo grupo da peça. */
const GRUPOS_ALVEOLARES = new Set(["LAB", "LABN", "LAC", "LACN", "PA", "PAB", "PAC", "TB"]);
export function linhaDoGrupo(grupo: string | null) {
  const g = normalizar(grupo);
  if (GRUPOS_ALVEOLARES.has(g)) return "ALVEOLARES";
  if (g === "ESC") return "ESTRUTURA";
  if (g.startsWith("E")) return "ESTACAS";
  return "ESTRUTURA";
}

/**
 * Linha das listas em matriz (armadura e metalurgia), pelo texto da coluna
 * Linha: os produtos (estrutura, alveolares, estacas) e as linhas de obra
 * (montagem, fundação, capeamento, metálica, turn-key), como no cadastro.
 */
const LINHAS_DO_TEXTO: Record<string, { tipo: "PRODUTO" | "OBRA"; codigo: string }> = {
  ESTRUTURA: { tipo: "PRODUTO", codigo: "ESTRUTURA" },
  ALVEOLARES: { tipo: "PRODUTO", codigo: "ALVEOLARES" },
  ESTACAS: { tipo: "PRODUTO", codigo: "ESTACAS" },
  MONTAGEM: { tipo: "OBRA", codigo: "MONTAGEM" },
  FUNDACAO: { tipo: "OBRA", codigo: "FUNDAÇÃO" },
  CAPEAMENTO: { tipo: "OBRA", codigo: "CAPEAMENTO" },
  METALICA: { tipo: "OBRA", codigo: "METÁLICA" },
  "TURN-KEY": { tipo: "OBRA", codigo: "TURN-KEY" },
};
const semAcento = (v: ValorCelula | undefined) => normalizar(v).normalize("NFD").replace(/[̀-ͯ]/g, "");
export const linhaDoTexto = (v: ValorCelula | undefined) => LINHAS_DO_TEXTO[semAcento(v)] ?? null;

/** Unidade das listas em matriz: MATRIZ, FILIAL ou SERVIÇOS. */
const UNIDADES_DO_TEXTO: Record<string, CodigoUnidade> = { MATRIZ: 1, FILIAL: 2, SERVICOS: 3 };

/** Texto que o Excel converteria em número ("26", "8,5"); senão undefined. */
function numeroDeTexto(s: string): Decimal | undefined {
  const t = s.trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? new Decimal(t) : undefined;
}

/**
 * Volume adotado da expedição — a coluna V. Adot. (m³). O informado, se
 * houver; senão, para peça "XX26-8", seção de 26 cm (+0,5) ao quadrado vezes
 * 8 m de comprimento; senão, peso / 2.500 kg/m³.
 */
export function volumeAdotado(volume: Decimal, peca: string | null, peso: Decimal): Decimal {
  if (!volume.isZero()) return volume;
  const p = peca ?? "";
  const traco = p.indexOf("-");
  if (traco > 0) {
    const secao = numeroDeTexto(p.slice(0, traco).slice(-2));
    const comprimento = numeroDeTexto(p.slice(traco + 1));
    if (secao && comprimento) return secao.plus(0.5).div(100).pow(2).times(comprimento);
  }
  return peso.div(2500);
}

// ---------------------------------------------------------------------------

const projetos: DefinicaoLista = {
  tipo: "PROJETO",
  rotulo: "Projetos liberados",
  abas: ["Projetos (Lista)"],
  interpretar(linhas, ano, mes) {
    const cab = localizarCabecalho(
      linhas,
      ["UNIDADE", "OBRA", "SIGLA OBRA", "DATA", "VOLUME (M³)", "PRODUTO"],
      ["NOME PEÇA", "CÓDIGO PEÇA", "PESO (KG)", "COMPRIMENTO (M)", "GRUPO", "SEÇÃO"],
    );
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const k = cab.col;
    return percorrer(linhas, cab.numero, (l, c) => {
      if (vazia(c(k.UNIDADE))) return { tipo: "vazia" };
      const d = data(c(k.DATA));
      if (!d) return rejeitar(l.numero, "DATA_INVALIDA", `Data "${c(k.DATA) ?? ""}" inválida.`);
      if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" };
      const unidade = unidadeDoTexto(c(k.UNIDADE));
      if (!unidade || unidade === 3) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE)}" não é Unidade 01 nem 02.`);
      const volume = numero(c(k["VOLUME (M³)"]));
      if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
      const produto = texto(c(k.PRODUTO));
      return {
        tipo: "registros",
        registros: [{
          linhaArquivo: l.numero,
          obra: obraDe(c(k["SIGLA OBRA"]), c(k.OBRA)),
          unidade,
          linha: { tipo: "PRODUTO", codigo: linhaDoProduto(unidade, produto) },
          quantidade: volume,
          campos: {
            data: d,
            produto,
            nomePeca: texto(c(k["NOME PEÇA"])),
            codigoPeca: texto(c(k["CÓDIGO PEÇA"])),
            grupo: texto(c(k.GRUPO)),
            secao: texto(c(k["SEÇÃO"])),
            comprimento: numero(c(k["COMPRIMENTO (M)"])) ?? null,
            pesoKg: numero(c(k["PESO (KG)"])) ?? null,
          },
        }],
      };
    });
  },
};

const producao: DefinicaoLista = {
  tipo: "PRODUCAO",
  rotulo: "Produção (m³)",
  abas: ["Produção (Lista m3)"],
  interpretar(linhas, ano, mes) {
    const cab = localizarCabecalho(
      linhas,
      ["DATA", "UNIDADE", "OBRA", "NOME DA OBRA", "PRODUTO", "VOLUME (M³)"],
      ["CÓDIGO CONTROLE", "NOME PEÇA", "COMPRIMENTO", "SEÇÃO"],
    );
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const k = cab.col;
    return percorrer(linhas, cab.numero, (l, c) => {
      if (vazia(c(k.DATA))) return { tipo: "vazia" };
      const d = data(c(k.DATA));
      if (!d) return rejeitar(l.numero, "DATA_INVALIDA", `Data "${c(k.DATA) ?? ""}" inválida.`);
      if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" };
      const unidade = unidadeDoTexto(c(k.UNIDADE));
      if (!unidade || unidade === 3) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE)}" não é Unidade 01 nem 02.`);
      const volume = numero(c(k["VOLUME (M³)"]));
      if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
      const produto = texto(c(k.PRODUTO));
      return {
        tipo: "registros",
        registros: [{
          linhaArquivo: l.numero,
          obra: obraDe(c(k.OBRA), c(k["NOME DA OBRA"])),
          unidade,
          linha: { tipo: "PRODUTO", codigo: linhaDoProduto(unidade, produto) },
          quantidade: volume,
          campos: {
            data: d,
            produto,
            nomePeca: texto(c(k["NOME PEÇA"])),
            codigoControle: texto(c(k["CÓDIGO CONTROLE"])),
            secao: texto(c(k["SEÇÃO"])),
            comprimento: numero(c(k.COMPRIMENTO)) ?? null,
          },
        }],
      };
    });
  },
};

const pistas: DefinicaoLista = {
  tipo: "PRODUCAO_PISTA",
  rotulo: "Produção (pistas)",
  abas: ["Produção (Lista pst)"],
  interpretar(linhas, ano, mes) {
    const cab = localizarCabecalho(linhas, ["DATA", "ALVEOLARES", "ESTACAS"]);
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const k = cab.col;
    return percorrer(linhas, cab.numero, (l, c) => {
      const d = data(c(k.DATA));
      if (!d) return vazia(c(k.DATA)) ? { tipo: "vazia" } : rejeitar(l.numero, "DATA_INVALIDA", `Data "${c(k.DATA)}" inválida.`);
      if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" };
      const registros: RegistroLista[] = [];
      for (const linha of ["ALVEOLARES", "ESTACAS"] as const) {
        const q = numero(c(k[linha]));
        if (!q) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", `Pistas de ${linha.toLowerCase()} não é número.`);
        if (q.isZero()) continue;
        // Pistas são da Filial: é lá que ficam alveolares e estacas.
        registros.push({ linhaArquivo: l.numero, obra: null, unidade: 2, linha: { tipo: "PRODUTO", codigo: linha }, quantidade: q, campos: { data: d } });
      }
      return { tipo: "registros", registros };
    });
  },
};

const armadura: DefinicaoLista = {
  tipo: "PRODUCAO_ARMADURA",
  rotulo: "Produção de armadura (kg)",
  abas: ["Produção (Lista Arm.)"],
  interpretar(linhas, ano, mes) {
    // Desde 09/10/2026: Unidade, Linha e Und. Antes: uma coluna só, UNIDADE/LINHA.
    const novo = localizarCabecalho(linhas, ["UNIDADE", "LINHA"], ["UND."]);
    if (!("erro" in novo)) return armaduraPorLinha(linhas, novo, ano, mes);
    const cab = localizarCabecalho(linhas, ["UNIDADE/LINHA"]);
    if ("erro" in cab) return { ok: false, motivo: novo.erro };
    const linhaCab = linhas.find((l) => l.numero === cab.numero)!;
    const colMes = colunaDoMes(linhaCab.celulas, ano, mes);
    if (typeof colMes !== "number") return { ok: false, motivo: colMes.erro };
    const avisos: string[] = [];
    const leitura = percorrer(linhas, cab.numero, (l, c) => {
      const categoria = texto(c(0));
      if (!categoria) return { tipo: "vazia" };
      const q = numero(c(colMes));
      if (!q) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", `Peso de "${categoria}" não é número.`);
      const destino = destinoDaArmadura(categoria);
      if (!destino) avisos.push(`Linha ${l.numero}: "${categoria}" não tem destino de rateio conhecido; entra sem unidade.`);
      return {
        tipo: "registros",
        registros: [{ linhaArquivo: l.numero, obra: null, unidade: destino ? UNIDADE_DO_DESTINO[destino] : null, linha: null, quantidade: q, campos: { categoria } }],
      };
    }, avisos);
    return leitura;
  },
};

/** Armadura no leiaute com Unidade, Linha e Und.: a categoria é a Linha, que diz o destino do rateio. */
function armaduraPorLinha(linhas: LinhaPlanilha[], cab: { numero: number; col: Record<string, number> }, ano: number, mes: number): LeituraLista {
  const k = cab.col;
  const linhaCab = linhas.find((l) => l.numero === cab.numero)!;
  const colMes = colunaDoMes(linhaCab.celulas, ano, mes);
  if (typeof colMes !== "number") return { ok: false, motivo: colMes.erro };
  const avisos: string[] = [];
  return percorrer(linhas, cab.numero, (l, c) => {
    const categoria = texto(c(k.LINHA));
    if (!categoria) return { tipo: "vazia" };
    const q = numero(c(colMes));
    if (!q) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", `Peso de "${categoria}" não é número.`);
    const unidade = UNIDADES_DO_TEXTO[semAcento(c(k.UNIDADE))] ?? null;
    if (!unidade) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE) ?? ""}" não é MATRIZ, FILIAL nem SERVIÇOS.`);
    const linha = linhaDoTexto(categoria);
    if (!linha) avisos.push(`Linha ${l.numero}: a linha "${categoria}" não está no cadastro de linhas.`);
    if (!destinoDaArmadura(categoria)) avisos.push(`Linha ${l.numero}: "${categoria}" não tem destino de rateio conhecido.`);
    return { tipo: "registros", registros: [{ linhaArquivo: l.numero, obra: null, unidade, linha, quantidade: q, campos: { categoria } }] };
  }, avisos);
}

const metalurgia: DefinicaoLista = {
  tipo: "PRODUCAO_METALURGIA",
  rotulo: "Produção da metalurgia (kg)",
  abas: ["Produção Mensal"],
  interpretar(linhas, ano, mes) {
    // A coluna LINHA entrou na Produção Mensal em 09/10/2026 (opcional, para os arquivos antigos).
    const cab = localizarCabecalho(linhas, ["FINALIDADE"], ["LINHA"]);
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const linhaCab = linhas.find((l) => l.numero === cab.numero)!;
    const colMes = colunaDoMes(linhaCab.celulas, ano, mes);
    if (typeof colMes !== "number") return { ok: false, motivo: colMes.erro };

    // As linhas TOTAL: da própria aba servem para conferir o mapeamento de
    // finalidades — se a planilha agrupar diferente, a diferença aparece aqui.
    const totaisDaAba = new Map<string, Decimal>();
    const avisos: string[] = [];
    const leitura = percorrer(linhas, cab.numero, (l, c) => {
      const finalidade = texto(c(0));
      if (!finalidade || finalidade === "0") return { tipo: "vazia" };
      const q = numero(c(colMes));
      if (!q) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", `Peso de "${finalidade}" não é número.`);
      if (/^TOTAL\s*:/i.test(finalidade)) {
        totaisDaAba.set(normalizar(finalidade.split(":")[1]), q);
        return { tipo: "vazia" };
      }
      const destino = destinoDaFinalidade(finalidade);
      if (destino === undefined) avisos.push(`Linha ${l.numero}: finalidade "${finalidade}" desconhecida; entra sem destino de rateio.`);
      const textoLinha = cab.col.LINHA >= 0 ? texto(c(cab.col.LINHA)) : null;
      const linha = textoLinha && textoLinha !== "-" ? linhaDoTexto(textoLinha) : null;
      if (textoLinha && textoLinha !== "-" && !linha) avisos.push(`Linha ${l.numero}: a linha "${textoLinha}" não está no cadastro de linhas.`);
      return {
        tipo: "registros",
        registros: [{ linhaArquivo: l.numero, obra: null, unidade: destino ? UNIDADE_DO_DESTINO[destino] : null, linha, quantidade: q, campos: { finalidade } }],
      };
    }, avisos);
    if (!leitura.ok) return leitura;

    const soma = (f: (r: RegistroLista) => boolean) =>
      leitura.registros.filter(f).reduce((a, r) => a.plus(r.quantidade), new Decimal(0));
    const fin = (r: RegistroLista) => String(r.campos.finalidade ?? "");
    const conferir: Array<[string, Decimal]> = [
      ["GERAL", soma(() => true)],
      ...(["MATRIZ", "FILIAL", "MONTAGEM", "COMPLEMENTAR"] as const).map(
        (d) => [d, soma((r) => destinoDaFinalidade(fin(r)) === d)] as [string, Decimal],
      ),
    ];
    for (const [nome, calculado] of conferir) {
      const daAba = totaisDaAba.get(nome);
      if (daAba && daAba.minus(calculado).abs().greaterThan(0.01)) {
        avisos.push(`TOTAL: ${nome} da aba é ${daAba.toFixed(2)} kg e a soma das finalidades dá ${calculado.toFixed(2)} kg.`);
      }
    }
    return leitura;
  },
};

const expedicao: DefinicaoLista = {
  tipo: "EXPEDICAO",
  rotulo: "Expedição",
  abas: ["Expedição (Lista)"],
  interpretar(linhas, ano, mes) {
    const cab = localizarCabecalho(
      linhas,
      ["DATA", "OBRA", "NOME DA OBRA", "NOME DA PEÇA", "PESO (KG)", "VOLUME (M³)"],
      ["Nº DA CARGA", "CÓDIGO CONTROLE", "V. ADOT. (M³)"],
    );
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const k = cab.col;
    let divergentes = 0;
    const exemplos: string[] = [];
    const leitura = percorrer(linhas, cab.numero, (l, c) => {
      if (vazia(c(k.DATA))) return { tipo: "vazia" };
      const d = data(c(k.DATA));
      if (!d) return rejeitar(l.numero, "DATA_INVALIDA", `Data "${c(k.DATA)}" inválida.`);
      if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" };
      const volume = numero(c(k["VOLUME (M³)"]));
      const peso = numero(c(k["PESO (KG)"]));
      if (!volume || !peso) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume ou peso não é número.");
      const peca = texto(c(k["NOME DA PEÇA"]));
      const adotado = volumeAdotado(volume, peca, peso);
      // Onde a planilha ainda tem a coluna calculada, confere a regra.
      const daPlanilha = k["V. ADOT. (M³)"] >= 0 ? numero(c(k["V. ADOT. (M³)"])) : undefined;
      if (daPlanilha && !vazia(c(k["V. ADOT. (M³)"])) && daPlanilha.minus(adotado).abs().greaterThan(0.0005)) {
        divergentes++;
        if (exemplos.length < 3) exemplos.push(`linha ${l.numero} (${peca}): planilha ${daPlanilha.toFixed(4)}, regra ${adotado.toFixed(4)}`);
      }
      const linha = linhaDaPeca(peca);
      return {
        tipo: "registros",
        registros: [{
          linhaArquivo: l.numero,
          obra: obraDe(c(k.OBRA), c(k["NOME DA OBRA"])),
          unidade: linha === "ESTRUTURA" ? 1 : 2,
          linha: { tipo: "PRODUTO", codigo: linha },
          quantidade: adotado,
          campos: {
            data: d,
            numeroCarga: texto(c(k["Nº DA CARGA"])),
            nomePeca: peca,
            codigoControle: texto(c(k["CÓDIGO CONTROLE"])),
            pesoKg: peso,
            volumeInformado: volume,
          },
        }],
      };
    });
    if (leitura.ok && divergentes > 0) {
      leitura.avisos.push(`${divergentes} linha(s) com volume adotado diferente da coluna V. Adot. da planilha: ${exemplos.join("; ")}.`);
    }
    return leitura;
  },
};

const montagem: DefinicaoLista = {
  tipo: "MONTAGEM",
  rotulo: "Montagem",
  abas: ["Montagem (Lista)"],
  interpretar(linhas, ano, mes) {
    const cab = localizarCabecalho(linhas, ["DATA", "NOME DA OBRA", "OBRA", "GRUPO", "VOLUME (M³)"], ["SEÇÃO", "QUANT."]);
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const k = cab.col;
    return percorrer(linhas, cab.numero, (l, c) => {
      if (vazia(c(k.DATA))) return { tipo: "vazia" };
      const d = data(c(k.DATA));
      if (!d) return rejeitar(l.numero, "DATA_INVALIDA", `Data "${c(k.DATA)}" inválida.`);
      if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" };
      const volume = numero(c(k["VOLUME (M³)"]));
      if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
      const grupo = texto(c(k.GRUPO));
      const linha = linhaDoGrupo(grupo);
      return {
        tipo: "registros",
        registros: [{
          linhaArquivo: l.numero,
          obra: obraDe(c(k.OBRA), c(k["NOME DA OBRA"])),
          unidade: linha === "ESTRUTURA" ? 1 : 2,
          linha: { tipo: "PRODUTO", codigo: linha },
          quantidade: volume,
          campos: { data: d, grupo, secao: texto(c(k["SEÇÃO"])), quantidadePecas: numero(c(k["QUANT."])) ?? null },
        }],
      };
    });
  },
};

const acompanhamentos: DefinicaoLista = {
  tipo: "ACOMPANHAMENTO",
  rotulo: "Acompanhamento de obra",
  abas: ["Acompanhamentos"],
  interpretar(linhas, ano, mes) {
    const cab = localizarCabecalho(linhas, ["PERÍODO", "PROJETO", "OBRA", "ETAPA", "DIAS DE ACOMP."], ["OBSERVAÇÃO"]);
    if ("erro" in cab) return { ok: false, motivo: cab.erro };
    const k = cab.col;
    return percorrer(linhas, cab.numero, (l, c) => {
      if (vazia(c(k["PERÍODO"]))) return { tipo: "vazia" };
      const d = data(c(k["PERÍODO"]));
      if (!d) return rejeitar(l.numero, "DATA_INVALIDA", `Período "${c(k["PERÍODO"])}" inválido.`);
      if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" };
      const dias = numero(c(k["DIAS DE ACOMP."]));
      if (!dias) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Dias de acompanhamento não é número.");
      const etapa = texto(c(k.ETAPA));
      return {
        tipo: "registros",
        registros: [{
          linhaArquivo: l.numero,
          obra: obraDe(c(k.PROJETO), c(k.OBRA)),
          unidade: 3,
          linha: etapa ? { tipo: "OBRA", codigo: normalizar(etapa) } : null,
          quantidade: dias,
          campos: { etapa, observacao: texto(c(k["OBSERVAÇÃO"])) },
        }],
      };
    });
  },
};

export const DEFINICOES_LISTAS: Record<TipoListaRateio, DefinicaoLista> = {
  PROJETO: projetos,
  PRODUCAO: producao,
  PRODUCAO_PISTA: pistas,
  PRODUCAO_ARMADURA: armadura,
  PRODUCAO_METALURGIA: metalurgia,
  EXPEDICAO: expedicao,
  MONTAGEM: montagem,
  ACOMPANHAMENTO: acompanhamentos,
};

export function ehListaRateio(tipo: TipoImportacao): tipo is TipoListaRateio {
  return tipo in DEFINICOES_LISTAS;
}
