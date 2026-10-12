import type { Prisma } from "../../../generated/prisma/client.js";
import type { LinhaPlanilha, ValorCelula } from "../../../lib/xlsx.js";
import { data, localizarCabecalho, mesmoMes, numero, texto } from "../listas/leituraListas.js";

type Decimal = Prisma.Decimal;

/**
 * A leitura das abas Requisições (Lista) e Notas Fiscais (Lista) do SIG BPM 2026 - LISTAS REALIZADO (RESULTADOS)
 * (11/10/2026): os itens do mês (a coluna PERÍODO), com a conta contábil (o código reduzido da Conta de Resultado),
 * o centro de custo (pelo código RM), a filial e o valor. É o que o extrato de uma conta na DRE abre. Não entra na
 * apuração.
 */

export type TipoDocumentos = "REQUISICOES" | "NOTAS_FISCAIS";

export const DEFINICOES_DOCUMENTOS: Record<TipoDocumentos, { aba: string; rotulo: string }> = {
  REQUISICOES: { aba: "Requisições (Lista)", rotulo: "Requisições" },
  NOTAS_FISCAIS: { aba: "Notas Fiscais (Lista)", rotulo: "Notas Fiscais" },
};

export const ehTipoDocumentos = (tipo: string): tipo is TipoDocumentos => tipo in DEFINICOES_DOCUMENTOS;

/** As colunas de cada aba: as obrigatórias e as que se leem quando existem. */
const COLUNAS: Record<TipoDocumentos, { obrigatorias: string[]; opcionais: string[] }> = {
  REQUISICOES: {
    obrigatorias: ["CONTA_CONTABIL", "VLR_TOTAL", "PERÍODO"],
    opcionais: [
      "IDENTIFICADOR", "TIPO_MOV", "NM_TIPO", "DATA_BAIXA", "FILIAL", "CENTRO_CUSTO", "PROJETO", "NOME_CENTRO_CUSTO", "TAREFA", "NAT_ORC",
      "NOME_TAREFA", "DESC_CONTA_CONTABIL", "CD_PRODUTO", "DESCRIÇÃO_ITEM", "QUANTIDADE", "CONTA_ESTOQUE", "VLR_UNIT",
    ],
  },
  NOTAS_FISCAIS: {
    obrigatorias: ["CONTA_CONTABIL", "VLR_TOTAL", "PERÍODO"],
    opcionais: [
      "IDENTIFICADOR", "DATA_EMISSAO", "DATA_SAIDA", "NF", "CENTRO_CUSTO", "PROJETO", "TAREFA", "CENTRO DE CUSTO", "FILIAL", "NOME_TAREFA",
      "CD_FORNECEDOR", "FANTASIA", "CD_PRODUTO", "DESCRICAO_ITEM", "QTD", "SUBTOTAL", "VLR_TOTAL", "DESCONTO", "CFOP", "TIPO_MOV",
      "NM_TIPO_MOV", "NAT_ORCAMENTARIA",
    ],
  },
};

type Comum = {
  linhaArquivo: number;
  identificador: string | null;
  filial: number | null;
  codigoCentroCusto: string | null;
  nomeCentroCusto: string | null;
  projeto: string | null;
  tarefa: string | null;
  nomeTarefa: string | null;
  naturezaOrcamentaria: string | null;
  contaContabil: string;
  codigoProduto: string | null;
  descricaoItem: string | null;
  quantidade: Decimal | null;
  valorTotal: Decimal;
  tipoMovimento: string | null;
  nomeTipoMovimento: string | null;
};
export type ItemRequisicao = Comum & { dataBaixa: Date | null; descricaoConta: string | null; contaEstoque: string | null; valorUnitario: Decimal | null };
export type ItemNotaFiscal = Comum & {
  dataEmissao: Date | null;
  dataSaida: Date | null;
  numero: string | null;
  codigoFornecedor: string | null;
  fornecedor: string | null;
  subtotal: Decimal | null;
  desconto: Decimal | null;
  cfop: string | null;
};
export type RejeicaoDocumento = { linha: number; codigo: "SEM_CONTA" | "VALOR_INVALIDO"; mensagem: string };
export type LeituraDocumentos<T> =
  | { ok: true; itens: T[]; rejeicoes: RejeicaoDocumento[]; lidas: number; foraDoMes: number }
  | { ok: false; motivo: string };

/** O código como texto (os números do RM sem ".0"). */
const codigo = (v: ValorCelula | undefined) => (typeof v === "number" ? String(v) : texto(v));
const opcionalNumero = (v: ValorCelula | undefined) => (v === null || v === undefined || v === "" ? null : (numero(v) ?? null));

/** Os itens do mês de uma das abas. */
export function lerDocumentos(tipo: "REQUISICOES", linhas: LinhaPlanilha[], ano: number, mes: number): LeituraDocumentos<ItemRequisicao>;
export function lerDocumentos(tipo: "NOTAS_FISCAIS", linhas: LinhaPlanilha[], ano: number, mes: number): LeituraDocumentos<ItemNotaFiscal>;
export function lerDocumentos(tipo: TipoDocumentos, linhas: LinhaPlanilha[], ano: number, mes: number): LeituraDocumentos<ItemRequisicao | ItemNotaFiscal> {
  const def = COLUNAS[tipo];
  const cab = localizarCabecalho(linhas, def.obrigatorias, def.opcionais);
  if ("erro" in cab) return { ok: false, motivo: cab.erro };
  const c = (l: LinhaPlanilha, n: string) => (cab.col[n] >= 0 ? l.celulas[cab.col[n]] : null);
  const itens: Array<ItemRequisicao | ItemNotaFiscal> = [];
  const rejeicoes: RejeicaoDocumento[] = [];
  let lidas = 0;
  let foraDoMes = 0;
  for (const l of linhas) {
    if (l.numero <= cab.numero) continue;
    const periodo = data(c(l, "PERÍODO"));
    if (!periodo) continue; // linha vazia ou de total
    lidas++;
    if (!mesmoMes(periodo, ano, mes)) {
      foraDoMes++;
      continue;
    }
    const conta = codigo(c(l, "CONTA_CONTABIL"));
    if (!conta) {
      rejeicoes.push({ linha: l.numero, codigo: "SEM_CONTA", mensagem: "Linha sem CONTA_CONTABIL." });
      continue;
    }
    const valor = numero(c(l, "VLR_TOTAL"));
    if (valor === undefined) {
      rejeicoes.push({ linha: l.numero, codigo: "VALOR_INVALIDO", mensagem: `VLR_TOTAL não é um número: ${String(c(l, "VLR_TOTAL"))}.` });
      continue;
    }
    const filial = Number(c(l, "FILIAL"));
    const comum: Comum = {
      linhaArquivo: l.numero,
      identificador: codigo(c(l, "IDENTIFICADOR")),
      filial: Number.isInteger(filial) && filial > 0 ? filial : null,
      codigoCentroCusto: texto(c(l, "CENTRO_CUSTO")),
      nomeCentroCusto: texto(c(l, tipo === "REQUISICOES" ? "NOME_CENTRO_CUSTO" : "CENTRO DE CUSTO")),
      projeto: codigo(c(l, "PROJETO")),
      tarefa: codigo(c(l, "TAREFA")),
      nomeTarefa: texto(c(l, "NOME_TAREFA")),
      naturezaOrcamentaria: texto(c(l, tipo === "REQUISICOES" ? "NAT_ORC" : "NAT_ORCAMENTARIA")),
      contaContabil: conta,
      codigoProduto: codigo(c(l, "CD_PRODUTO")),
      descricaoItem: texto(c(l, tipo === "REQUISICOES" ? "DESCRIÇÃO_ITEM" : "DESCRICAO_ITEM")),
      quantidade: opcionalNumero(c(l, tipo === "REQUISICOES" ? "QUANTIDADE" : "QTD")),
      valorTotal: valor,
      tipoMovimento: texto(c(l, "TIPO_MOV")),
      nomeTipoMovimento: texto(c(l, tipo === "REQUISICOES" ? "NM_TIPO" : "NM_TIPO_MOV")),
    };
    itens.push(
      tipo === "REQUISICOES"
        ? { ...comum, dataBaixa: data(c(l, "DATA_BAIXA")), descricaoConta: texto(c(l, "DESC_CONTA_CONTABIL")), contaEstoque: codigo(c(l, "CONTA_ESTOQUE")), valorUnitario: opcionalNumero(c(l, "VLR_UNIT")) }
        : {
            ...comum,
            dataEmissao: data(c(l, "DATA_EMISSAO")),
            dataSaida: data(c(l, "DATA_SAIDA")),
            numero: codigo(c(l, "NF")),
            codigoFornecedor: codigo(c(l, "CD_FORNECEDOR")),
            fornecedor: texto(c(l, "FANTASIA")),
            subtotal: opcionalNumero(c(l, "SUBTOTAL")),
            desconto: opcionalNumero(c(l, "DESCONTO")),
            cfop: codigo(c(l, "CFOP")),
          },
    );
  }
  return { ok: true, itens, rejeicoes, lidas, foraDoMes };
}
