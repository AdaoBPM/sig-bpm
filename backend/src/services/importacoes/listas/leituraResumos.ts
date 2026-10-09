import { Prisma } from "../../../generated/prisma/client.js";
import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";
import {
  data,
  localizarCabecalho,
  mesmoMes,
  normalizar,
  numero,
  obraDe,
  percorrer,
  rejeitar,
  texto,
  unidadeDoTexto,
  vazia,
  type LeituraLista,
  type RegistroLista,
} from "./leituraListas.js";

const Decimal = Prisma.Decimal;

/**
 * As abas (Resumo) do SIG BPM 2026 - LISTAS REALIZADO (OPERAÇÃO), que
 * substituíram as abas (Lista) na importação em 09/10/2026: Projetos,
 * Produção, Expedição, Montagem, Devoluções e Saídas. Cada linha é a soma das
 * linhas da lista com a mesma etiqueta — período, obra, linha e, nas estacas,
 * a peça —, com a coluna Linha já calculada pela planilha. Têm menos
 * informação (sem peça a peça, sem nota fiscal), mas os totais por obra,
 * linha, peça de estaca e movimento são os mesmos: é com eles que a
 * ferramenta faz os rateios, a receita prévia e o estoque.
 *
 * Cada leitura devolve null quando a aba não tem o cabeçalho do resumo — a
 * lista é lida então no leiaute antigo (a digitação usa esse leiaute).
 */

type Cabecalho = { numero: number; col: Record<string, number> };

/**
 * O cabeçalho do resumo, ou null (a aba é a lista antiga). As listas também
 * têm Período, Linha e Etiqueta (colunas calculadas); o que as separa do
 * resumo é a data de cada registro (Data, ou a data de emissão das notas).
 */
const DATAS_DA_LISTA = ["DATA", "DATA EMISSÃO", "DATA_EMISSAO"];
function cabecalhoDoResumo(linhas: LinhaPlanilha[], obrigatorias: string[], opcionais: string[] = []): Cabecalho | null {
  const cab = localizarCabecalho(linhas, ["PERÍODO", ...obrigatorias], opcionais);
  if ("erro" in cab) return null;
  const nomes = linhas.find((l) => l.numero === cab.numero)!.celulas.map(normalizar);
  return DATAS_DA_LISTA.some((d) => nomes.includes(d)) ? null : cab;
}

/** O texto da coluna, sem o "-" que os resumos põem onde não há valor (grupo e seção da estrutura, peça fora das estacas). */
const valorDe = (v: ValorCelula) => {
  const t = texto(v);
  return t && t !== "-" ? t : null;
};

/** As linhas de produto dos resumos de pré-fabricado. */
const LINHAS_PRODUTO = new Set(["ESTRUTURA", "ALVEOLARES", "ESTACAS"]);

/** O período do resumo (o dia 1º do mês, às vezes com hora): fora do mês, outra competência. */
function periodo(c: (i: number) => ValorCelula, k: Record<string, number>, numeroLinha: number, ano: number, mes: number) {
  if (vazia(c(k["PERÍODO"]))) return { tipo: "vazia" as const };
  const d = data(c(k["PERÍODO"]));
  if (!d) return rejeitar(numeroLinha, "DATA_INVALIDA", `Período "${c(k["PERÍODO"]) ?? ""}" inválido.`);
  if (!mesmoMes(d, ano, mes)) return { tipo: "outroMes" as const };
  return { tipo: "ok" as const, d };
}

/** Projetos (Resumo): Período, Unidade, Sigla Obra, Obra, Venda, Linha, Grupo, Seção, Volume, Comprimento, Quantidade. */
export function projetosDoResumo(linhas: LinhaPlanilha[], ano: number, mes: number): LeituraLista | null {
  const cab = cabecalhoDoResumo(linhas, ["UNIDADE", "SIGLA OBRA", "OBRA", "LINHA", "VOLUME (M³)"], ["GRUPO", "SEÇÃO", "COMPRIMENTO (M)"]);
  if (!cab) return null;
  const k = cab.col;
  return percorrer(linhas, cab.numero, (l, c) => {
    const p = periodo(c, k, l.numero, ano, mes);
    if (p.tipo !== "ok") return p;
    const unidade = unidadeDoTexto(c(k.UNIDADE));
    if (!unidade || unidade === 3) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE) ?? ""}" não é Unidade 01 nem 02.`);
    const linha = normalizar(c(k.LINHA));
    if (!LINHAS_PRODUTO.has(linha)) return rejeitar(l.numero, "LINHA_INVALIDA", `Linha "${c(k.LINHA) ?? ""}" não é Estrutura, Alveolares nem Estacas.`);
    const volume = numero(c(k["VOLUME (M³)"]));
    if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
    return {
      tipo: "registros",
      registros: [{
        linhaArquivo: l.numero,
        obra: obraDe(c(k["SIGLA OBRA"]), c(k.OBRA)),
        unidade,
        linha: { tipo: "PRODUTO", codigo: linha },
        quantidade: volume,
        campos: {
          data: p.d,
          grupo: k.GRUPO >= 0 ? valorDe(c(k.GRUPO)) : null,
          secao: k["SEÇÃO"] >= 0 ? valorDe(c(k["SEÇÃO"])) : null,
          comprimento: k["COMPRIMENTO (M)"] >= 0 ? (numero(c(k["COMPRIMENTO (M)"])) ?? null) : null,
        },
      }],
    };
  });
}

/** Produção (Resumo): Período, Unidade, Obra, Nome da Obra, Linha, Grupo, Seção, Volume, Compr., Quantidade. */
export function producaoDoResumo(linhas: LinhaPlanilha[], ano: number, mes: number): LeituraLista | null {
  const cab = cabecalhoDoResumo(linhas, ["UNIDADE", "OBRA", "NOME DA OBRA", "LINHA", "VOLUME (M³)"], ["GRUPO", "SEÇÃO", "COMPR. (M)", "QUANTIDADE"]);
  if (!cab) return null;
  const k = cab.col;
  return percorrer(linhas, cab.numero, (l, c) => {
    const p = periodo(c, k, l.numero, ano, mes);
    if (p.tipo !== "ok") return p;
    const unidade = unidadeDoTexto(c(k.UNIDADE));
    if (!unidade || unidade === 3) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE) ?? ""}" não é Unidade 01 nem 02.`);
    const linha = normalizar(c(k.LINHA));
    if (!LINHAS_PRODUTO.has(linha)) return rejeitar(l.numero, "LINHA_INVALIDA", `Linha "${c(k.LINHA) ?? ""}" não é Estrutura, Alveolares nem Estacas.`);
    const volume = numero(c(k["VOLUME (M³)"]));
    if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
    const pecas = k.QUANTIDADE >= 0 ? numero(c(k.QUANTIDADE)) : undefined;
    return {
      tipo: "registros",
      registros: [{
        linhaArquivo: l.numero,
        obra: obraDe(c(k.OBRA), c(k["NOME DA OBRA"])),
        unidade,
        linha: { tipo: "PRODUTO", codigo: linha },
        quantidade: volume,
        campos: {
          data: p.d,
          // O grupo da peça (E, ES, ESD…) e a seção dão o preço da estaca na tabela.
          grupo: k.GRUPO >= 0 ? valorDe(c(k.GRUPO)) : null,
          secao: k["SEÇÃO"] >= 0 ? valorDe(c(k["SEÇÃO"])) : null,
          comprimento: k["COMPR. (M)"] >= 0 ? (numero(c(k["COMPR. (M)"])) ?? null) : null,
          quantidadePecas: pecas ? pecas.toNumber() : null,
        },
      }],
    };
  });
}

/** Expedição (Resumo): Período, Unidade, Obra, Nome da Obra, Linha, Peça (a da estaca; "-" nas demais), Volume (o adotado), Quantidade. */
export function expedicaoDoResumo(linhas: LinhaPlanilha[], ano: number, mes: number): LeituraLista | null {
  const cab = cabecalhoDoResumo(linhas, ["UNIDADE", "OBRA", "NOME DA OBRA", "LINHA", "PEÇA", "VOLUME (M³)"], ["QUANTIDADE"]);
  if (!cab) return null;
  const k = cab.col;
  return percorrer(linhas, cab.numero, (l, c) => {
    const p = periodo(c, k, l.numero, ano, mes);
    if (p.tipo !== "ok") return p;
    const unidade = unidadeDoTexto(c(k.UNIDADE));
    if (!unidade || unidade === 3) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE) ?? ""}" não é Unidade 01 nem 02.`);
    const linha = normalizar(c(k.LINHA));
    if (!LINHAS_PRODUTO.has(linha)) return rejeitar(l.numero, "LINHA_INVALIDA", `Linha "${c(k.LINHA) ?? ""}" não é Estrutura, Alveolares nem Estacas.`);
    const volume = numero(c(k["VOLUME (M³)"]));
    if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
    const peca = valorDe(c(k["PEÇA"]));
    return {
      tipo: "registros",
      registros: [{
        linhaArquivo: l.numero,
        obra: obraDe(c(k.OBRA), c(k["NOME DA OBRA"])),
        unidade,
        linha: { tipo: "PRODUTO", codigo: linha },
        quantidade: volume,
        // A peça da estaca (ES26, ESD30, E18…) dá o preço na tabela de estacas.
        campos: { data: p.d, nomePeca: peca },
      }],
    };
  });
}

/** Montagem (Resumo): Período, Unidade, Obra, Nome da Obra, Linha, Volume. */
export function montagemDoResumo(linhas: LinhaPlanilha[], ano: number, mes: number): LeituraLista | null {
  const cab = cabecalhoDoResumo(linhas, ["UNIDADE", "OBRA", "NOME DA OBRA", "LINHA", "VOLUME (M³)"]);
  if (!cab) return null;
  const k = cab.col;
  return percorrer(linhas, cab.numero, (l, c) => {
    const p = periodo(c, k, l.numero, ano, mes);
    if (p.tipo !== "ok") return p;
    const unidade = unidadeDoTexto(c(k.UNIDADE));
    if (!unidade || unidade === 3) return rejeitar(l.numero, "UNIDADE_INVALIDA", `Unidade "${c(k.UNIDADE) ?? ""}" não é Unidade 01 nem 02.`);
    const linha = normalizar(c(k.LINHA));
    if (!LINHAS_PRODUTO.has(linha)) return rejeitar(l.numero, "LINHA_INVALIDA", `Linha "${c(k.LINHA) ?? ""}" não é Estrutura, Alveolares nem Estacas.`);
    const volume = numero(c(k["VOLUME (M³)"]));
    if (!volume) return rejeitar(l.numero, "QUANTIDADE_INVALIDA", "Volume não é número.");
    return {
      tipo: "registros",
      registros: [{
        linhaArquivo: l.numero,
        obra: obraDe(c(k.OBRA), c(k["NOME DA OBRA"])),
        unidade,
        linha: { tipo: "PRODUTO", codigo: linha },
        quantidade: volume,
        campos: { data: p.d },
      }],
    };
  });
}

/** A linha das notas: a sucata é a METALURGIA do resumo, a linha METALÚRGICA do cadastro. */
function linhaDaNota(v: ValorCelula): string | null {
  const t = normalizar(v);
  if (LINHAS_PRODUTO.has(t)) return t;
  if (t === "METALURGIA" || t === "METALÚRGICA") return "METALÚRGICA";
  return null;
}

/**
 * Devoluções (Resumo) e Saídas (Resumo): Período, Filial, Projeto, Cliente
 * (ou Fantasia), Linha, Movimento, Valor e Deduções (os créditos de ICMS, PIS
 * e COFINS, já zerados nas obras globais e sem projeto). Sem a quantidade de
 * peças, que a receita não usa: a quantidade do registro fica zero.
 */
function notasDoResumo(saida: boolean) {
  return (linhas: LinhaPlanilha[], ano: number, mes: number): LeituraLista | null => {
    const cab = cabecalhoDoResumo(linhas, ["FILIAL", "PROJETO", "LINHA", "MOVIMENTO", "VALOR (R$)", "DEDUÇÕES (R$)"], ["CLIENTE", "FANTASIA"]);
    if (!cab) return null;
    const k = cab.col;
    return percorrer(linhas, cab.numero, (l, c) => {
      const p = periodo(c, k, l.numero, ano, mes);
      if (p.tipo !== "ok") return p;
      const linha = linhaDaNota(c(k.LINHA));
      if (!linha) return { tipo: "semEfeito" };
      const projeto = texto(c(k.PROJETO));
      // Como na lista: sem projeto, só a sucata (das saídas) entra.
      if (!projeto && !(saida && linha === "METALÚRGICA")) return { tipo: "semEfeito" };
      const [valor, deducoes] = ["VALOR (R$)", "DEDUÇÕES (R$)"].map((n) => numero(c(k[n])));
      if (!valor || !deducoes) return rejeitar(l.numero, "VALOR_INVALIDO", "Valor ou deduções não é número.");
      const filial = numero(c(k.FILIAL));
      const nome = k.CLIENTE >= 0 ? texto(c(k.CLIENTE)) : k.FANTASIA >= 0 ? texto(c(k.FANTASIA)) : null;
      return {
        tipo: "registros",
        registros: [{
          linhaArquivo: l.numero,
          obra: projeto ? obraDe(projeto, null) : null,
          // Saída: a sucata é da metalurgia, na Matriz; o resto, da Filial. Devolução: estrutura na Matriz; o resto, na Filial.
          unidade: saida ? (linha === "METALÚRGICA" ? 1 : 2) : linha === "ESTRUTURA" ? 1 : 2,
          linha: { tipo: "PRODUTO", codigo: linha },
          quantidade: new Decimal(0),
          campos: {
            data: p.d,
            filial: filial ? filial.toNumber() : null,
            descricao: nome,
            movimento: texto(c(k.MOVIMENTO)),
            valor,
            creditos: deducoes,
            unidadeMedida: "UND",
          },
        }],
      };
    });
  };
}

export const devolucoesDoResumo = notasDoResumo(false);
export const saidasDoResumo = notasDoResumo(true);

export type { RegistroLista };
